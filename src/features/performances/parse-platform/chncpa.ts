import { parseFirstPerformanceDate } from './date'
import { defaultParsePlatformJsonClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformJsonClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { parseHttpUrl, type ParsePlatformUrl, urlSearchParam } from './url'

const DETAIL_HOSTS = new Set(['m.chncpa.org', 'wticket.chncpa.org'])
const API_HOST = 'openapi.chncpa.org'

export class ChncpaParser implements ParsePlatformParser {
  readonly platformName = '国家大剧院'

  constructor(
    private readonly jsonClient: ParsePlatformJsonClient = defaultParsePlatformJsonClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return chncpaProductId(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    return parseChncpaResponse(await this.jsonClient.getJson(normalizeChncpaUrl(url)))
  }
}

export function normalizeChncpaUrl(url: ParsePlatformUrl): ParsePlatformUrl {
  const productId = chncpaProductId(url)
  if (!productId) throw new ParsePlatformError('invalid-url', '国家大剧院链接缺少有效的演出 ID')
  const normalized = parseHttpUrl(
    `https://${API_HOST}/product/detail?productId=${productId}&channel=wap`,
  )
  if (!normalized) throw new ParsePlatformError('invalid-url', '无法规范化国家大剧院链接')
  return normalized
}

export function parseChncpaResponse(payload: unknown): ParsePlatformResult {
  const root = asRecord(parseJson(payload))
  const data = asRecord(root.data)
  const name = text(data.productName) || text(data.name)
  if (!isSuccess(root.code) || !name) {
    throw new ParsePlatformError('invalid-response', '国家大剧院接口没有返回有效的演出数据')
  }

  const calendar = array(data.calendar)
  const dates = calendar
    .map((item) => parseFirstPerformanceDate(text(asRecord(item).sessionDate)))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)

  return {
    platformName: '国家大剧院',
    name,
    play: extractPlayTitles(name),
    startedAtMs: dates[0] ?? null,
    city: '北京',
    venue: text(data.venueName) || text(data.venue),
    artistNames: extractArtists(data.introduce),
    coverUrl: normalizeProtocolUrl(text(data.productImageMax) || text(data.cover)),
  }
}

function chncpaProductId(url: ParsePlatformUrl): string | null {
  if (
    url.protocol !== 'https:'
    || !DETAIL_HOSTS.has(url.hostname)
    || url.pathname !== '/product.html'
  ) return null
  const id = urlSearchParam(url, 'id')
  return id && /^\d+$/.test(id) ? id : null
}

function extractArtists(value: unknown): string[] {
  const result: string[] = []
  for (const item of array(value)) {
    const section = asRecord(item)
    if (!['40', '41'].includes(text(section.type))) continue
    for (const content of array(section.contents)) {
      const artist = text(asRecord(content).artistName)
      if (artist && !result.includes(artist)) result.push(artist)
    }
  }
  return result
}

function extractPlayTitles(name: string): string {
  return [...name.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim()).filter(Boolean).join('__PLAY__')
}

function normalizeProtocolUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value
}

function isSuccess(value: unknown): boolean {
  return value === 0 || value === '0'
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new ParsePlatformError('parsing-failed', '无法解析国家大剧院演出数据')
  }
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
