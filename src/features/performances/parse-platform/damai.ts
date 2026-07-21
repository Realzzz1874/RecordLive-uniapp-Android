import { defaultParsePlatformHttpClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'

const DESKTOP_HOST = 'detail.damai.cn'
const MOBILE_HOST = 'm.damai.cn'
const DESKTOP_PATH = '/item.htm'
const MOBILE_PATHS = new Set([
  '/shows/item.html',
  '/damai/detail/item.html',
])

export class DamaiParser implements ParsePlatformParser {
  readonly platformName = '大麦'

  constructor(
    private readonly httpClient: ParsePlatformHttpClient = defaultParsePlatformHttpClient,
  ) {}

  canParse(url: URL): boolean {
    if (url.protocol !== 'https:') return false
    if (url.hostname === DESKTOP_HOST && url.pathname === DESKTOP_PATH) {
      return isItemId(url.searchParams.get('id'))
    }
    if (url.hostname === MOBILE_HOST && MOBILE_PATHS.has(url.pathname)) {
      return isItemId(url.searchParams.get('itemId'))
    }
    return false
  }

  async parse(url: URL): Promise<ParsePlatformResult> {
    const normalizedUrl = normalizeDamaiUrl(url)
    const html = await this.httpClient.getText(normalizedUrl)
    return parseDamaiHtml(html)
  }
}

export function normalizeDamaiUrl(url: URL): URL {
  if (url.protocol !== 'https:') {
    throw new ParsePlatformError('invalid-url', '大麦链接必须使用 HTTPS')
  }

  const itemId = url.hostname === DESKTOP_HOST && url.pathname === DESKTOP_PATH
    ? url.searchParams.get('id')
    : url.hostname === MOBILE_HOST && MOBILE_PATHS.has(url.pathname)
      ? url.searchParams.get('itemId')
      : null
  if (!isItemId(itemId)) {
    throw new ParsePlatformError('invalid-url', '大麦链接缺少有效的演出 ID')
  }
  return new URL(`https://${DESKTOP_HOST}${DESKTOP_PATH}?id=${itemId}`)
}

export function parseDamaiHtml(html: string): ParsePlatformResult {
  const encodedJson = extractElementText(html, 'staticDataDefault')
  if (!encodedJson) {
    throw new ParsePlatformError('invalid-response', '大麦页面中没有演出数据')
  }

  let payload: unknown
  try {
    payload = JSON.parse(decodeHtmlEntities(encodedJson))
  } catch {
    throw new ParsePlatformError('parsing-failed', '无法解析大麦演出数据')
  }

  const root = asRecord(payload)
  const venue = asRecord(root.venue)
  const item = asRecord(root.itemBase)
  const name = textValue(item.itemName)
  if (!name) throw new ParsePlatformError('invalid-response', '大麦页面缺少演出名称')

  return {
    platformName: '大麦',
    name,
    play: extractPlayTitle(name),
    startedAtMs: parseDamaiDate(textValue(item.showTime)),
    city: removeCitySuffix(textValue(venue.venueCityName)),
    venue: textValue(venue.venueName),
    artistNames: [],
    coverUrl: normalizeProtocolUrl(textValue(item.itemPic)),
  }
}

export function parseDamaiDate(value: string): number | null {
  const match = value.trim().match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:\s+[^\d\s]+)?(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!match) return null
  const [, yearText, monthText, dayText, hourText = '0', minuteText = '0'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const date = new Date(year, month - 1, day, hour, minute)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) return null
  return date.getTime()
}

function extractElementText(html: string, id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<([a-z][\\w:-]*)\\b(?=[^>]*\\bid=["']${escapedId}["'])[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  )
  return pattern.exec(html)?.[2]?.trim() ?? ''
}

function extractPlayTitle(name: string): string {
  const match = name.match(/《([^》]+)》/)
  return match?.[1]?.trim() ?? ''
}

function removeCitySuffix(value: string): string {
  return value.endsWith('市') ? value.slice(0, -1) : value
}

function normalizeProtocolUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  }
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return named[entity.toLocaleLowerCase()] ?? `&${entity};`
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isItemId(value: string | null): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}
