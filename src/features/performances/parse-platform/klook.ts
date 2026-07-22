import { defaultParsePlatformHttpClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import type { ParsePlatformUrl } from './url'

const SHORT_HOSTS = new Set(['s.klook.cn', 'short.klook.cn'])

export class KlookParser implements ParsePlatformParser {
  readonly platformName = 'Klook'

  constructor(
    private readonly httpClient: ParsePlatformHttpClient = defaultParsePlatformHttpClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    if (url.protocol !== 'https:') return false
    if (SHORT_HOSTS.has(url.hostname)) {
      return url.pathname !== '/' && /^\/[a-z\d_-]+(?:\/[a-z\d_-]+)*\/?$/i.test(url.pathname)
    }
    if (!isKlookHost(url.hostname)) return false
    return /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?event-detail\/\d+(?:-[^/?#]+)?\/?$/i.test(url.pathname)
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    if (!this.canParse(url)) throw new ParsePlatformError('invalid-url', 'Klook 链接缺少有效的活动 ID')
    return parseKlookHtml(await this.httpClient.getText(url))
  }
}

export function parseKlookHtml(html: string): ParsePlatformResult {
  const embedded = extractAssignedJson(html, 'window.__KLOOK__')
  const detail = klookDetail(embedded)
  const schema = findEventSchema(html)
  const name = text(detail.title) || text(schema.name)
  if (!name) throw new ParsePlatformError('invalid-response', 'Klook 页面缺少活动名称')

  const address = asRecord(detail.address)
  const schemaLocation = asRecord(schema.location)
  const schemaAddress = asRecord(schemaLocation.address)
  const city = normalizeCity(
    text(detail.city_name) || text(schemaAddress.addressLocality) || text(schemaAddress.addressRegion),
  )
  const ticketInfo = text(detail.ticket_info)
  const range = asRecord(array(detail.date_range_list)[0])
  const rangeStart = text(range.start)
  const showTime = text(detail.event_showtime)

  return {
    platformName: 'Klook',
    name,
    play: extractPlayTitles(name),
    startedAtMs: parseExplicitChineseDate(ticketInfo)
      ?? parseDateAndTime(rangeStart, showTime)
      ?? parseIsoDate(text(schema.startDate)),
    city,
    venue: text(address.title) || text(address.desc) || text(schemaLocation.name),
    artistNames: inferArtists(name, asRecord(detail.seo).keywords),
    coverUrl: normalizeImage(detail.image_url ?? schema.image),
  }
}

function klookDetail(value: unknown): Record<string, unknown> {
  const state = asRecord(asRecord(value).state)
  const vertical = asRecord(state['event-vertical'])
  return asRecord(asRecord(vertical.detail).detailInfo)
}

function extractAssignedJson(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) return {}
  const start = html.indexOf('{', markerIndex + marker.length)
  if (start < 0) return {}
  const end = findBalancedEnd(html, start)
  if (end < 0) return {}
  try {
    return JSON.parse(html.slice(start, end)) as unknown
  } catch {
    throw new ParsePlatformError('parsing-failed', '无法解析 Klook 活动数据')
  }
}

function findBalancedEnd(value: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}' && --depth === 0) return index + 1
  }
  return -1
}

function findEventSchema(html: string): Record<string, unknown> {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const event = findEventValue(JSON.parse(match[1]) as unknown)
      if (event) return event
    } catch {
      continue
    }
  }
  return {}
}

function findEventValue(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findEventValue(item)
      if (result) return result
    }
    return null
  }
  const record = asRecord(value)
  const type = record['@type']
  if (type === 'Event' || (Array.isArray(type) && type.includes('Event'))) return record
  for (const child of Object.values(record)) {
    const result = findEventValue(child)
    if (result) return result
  }
  return null
}

function parseExplicitChineseDate(value: string): number | null {
  const date = value.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/)
  if (!date) return null
  const tail = value.slice((date.index ?? 0) + date[0].length, (date.index ?? 0) + date[0].length + 120)
  const time = tail.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})(?:[:：](\d{2})|[时時](半|正|\d{1,2}分)?)/)
  let hour = Number(time?.[2] ?? 0)
  if (['下午', '晚上'].includes(time?.[1] ?? '') && hour < 12) hour += 12
  if (time?.[1] === '中午' && hour < 11) hour += 12
  if (['凌晨', '早上', '上午'].includes(time?.[1] ?? '') && hour === 12) hour = 0
  const minute = time?.[3]
    ? Number(time[3])
    : time?.[4] === '半' ? 30 : Number(time?.[4]?.replace('分', '') || 0)
  return validLocalTimestamp(Number(date[1]), Number(date[2]), Number(date[3]), hour, minute)
}

function parseDateAndTime(dateValue: string, timeValue: string): number | null {
  const date = /^(20\d{2})-(\d{1,2})-(\d{1,2})/.exec(dateValue)
  if (!date) return null
  const time = /(\d{1,2}):(\d{2})/.exec(timeValue)
  return validLocalTimestamp(
    Number(date[1]), Number(date[2]), Number(date[3]), Number(time?.[1] ?? 0), Number(time?.[2] ?? 0),
  )
}

function parseIsoDate(value: string): number | null {
  const match = /^(20\d{2})-(\d{1,2})-(\d{1,2})(?:T|\s)?(\d{1,2})?:?(\d{2})?/.exec(value)
  if (!match) return null
  return validLocalTimestamp(
    Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0),
  )
}

function validLocalTimestamp(year: number, month: number, day: number, hour: number, minute: number): number | null {
  const date = new Date(year, month - 1, day, hour, minute)
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute
    ? date.getTime()
    : null
}

function inferArtists(name: string, value: unknown): string[] {
  let candidates: string[] = []
  if (Array.isArray(value)) candidates = value.filter((item): item is string => typeof item === 'string')
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      candidates = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : value.split(',')
    } catch {
      candidates = value.split(',')
    }
  }
  const normalizedName = name.toLocaleLowerCase()
  const artist = candidates
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find((item) => normalizedName.startsWith(item.toLocaleLowerCase()))
  return artist ? [artist] : []
}

function normalizeCity(value: string): string {
  if (value === '中国香港') return '香港'
  if (value === '中国澳门') return '澳门'
  return value.endsWith('市') ? value.slice(0, -1) : value
}

function normalizeImage(value: unknown): string {
  if (Array.isArray(value)) return text(value[0])
  if (typeof value === 'object' && value !== null) return text(asRecord(value).url)
  return text(value)
}

function extractPlayTitles(name: string): string {
  return [...name.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim()).filter(Boolean).join('__PLAY__')
}

function isKlookHost(hostname: string): boolean {
  return hostname === 'klook.cn' || hostname.endsWith('.klook.cn')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
