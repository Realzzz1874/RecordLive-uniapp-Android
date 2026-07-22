import { defaultParsePlatformJsonClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformJsonClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { parseHttpUrl, type ParsePlatformUrl } from './url'

const DETAIL_HOST = 'shows.cityline.com'

export class CitylineParser implements ParsePlatformParser {
  readonly platformName = 'cityline'

  constructor(
    private readonly jsonClient: ParsePlatformJsonClient = defaultParsePlatformJsonClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return citylineEventKey(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    return parseCitylineResponse(await this.jsonClient.getJson(normalizeCitylineUrl(url)))
  }
}

export function normalizeCitylineUrl(url: ParsePlatformUrl): ParsePlatformUrl {
  const key = citylineEventKey(url)
  if (!key) throw new ParsePlatformError('invalid-url', 'Cityline 链接缺少有效的演出路径')
  const normalized = parseHttpUrl(`https://${DETAIL_HOST}/data/${key}.json`)
  if (!normalized) throw new ParsePlatformError('invalid-url', '无法规范化 Cityline 链接')
  return normalized
}

export function parseCitylineResponse(payload: unknown): ParsePlatformResult {
  const root = asRecord(parseJson(payload))
  const content = asRecord(root.content)
  const name = text(content.titleSc) || text(content.titleTc) || text(content.titleEn)
  if (!name) throw new ParsePlatformError('invalid-response', 'Cityline 接口缺少演出名称')

  return {
    platformName: 'cityline',
    name,
    play: extractPlayTitles(name),
    startedAtMs: null,
    city: '',
    venue: text(content.venueSc) || text(content.venueTc) || text(content.venueEn),
    artistNames: [],
    coverUrl: normalizeAssetUrl(
      text(content.bannerUrlSc) || text(content.bannerUrlTc) || text(content.bannerUrlEn),
    ),
  }
}

function citylineEventKey(url: ParsePlatformUrl): string | null {
  if (url.protocol !== 'https:' || url.hostname !== DETAIL_HOST) return null
  return /^\/sc\/([a-z\d_-]+(?:\/[a-z\d_-]+)*)\.html$/i.exec(url.pathname)?.[1] ?? null
}

function normalizeAssetUrl(value: string): string {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${DETAIL_HOST}/${value.replace(/^\/+/, '')}`
}

function extractPlayTitles(name: string): string {
  return [...name.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim()).filter(Boolean).join('__PLAY__')
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new ParsePlatformError('parsing-failed', '无法解析 Cityline 演出数据')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
