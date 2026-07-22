import { parseFirstPerformanceDate } from './date'
import { defaultParsePlatformJsonClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformJsonClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { parseHttpUrl, type ParsePlatformUrl } from './url'

const WEIXIN_HOST = 'weixin.polyt.cn'
const MOBILE_HOST = 'm.polyt.cn'
const DESKTOP_HOST = 'www.polyt.cn'
const API_PATH_PREFIX = '/platform-backend/good/project/detail/'

interface PolyLinkInfo {
  productId: string
  theaterId: string | null
}

export class PolyParser implements ParsePlatformParser {
  readonly platformName = '保利票务'

  constructor(
    private readonly jsonClient: ParsePlatformJsonClient = defaultParsePlatformJsonClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return extractPolyLinkInfo(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    const info = extractPolyLinkInfo(url)
    if (!info) throw new ParsePlatformError('invalid-url', '保利票务链接缺少有效的演出 ID')

    const headers: Record<string, string> = { Channel: 'plat_h5' }
    if (info.theaterId) headers.Theater = info.theaterId
    const payload = await this.jsonClient.getJson(normalizePolyUrl(url), headers)
    return parsePolyResponse(payload)
  }
}

export function normalizePolyUrl(url: ParsePlatformUrl): ParsePlatformUrl {
  const info = extractPolyLinkInfo(url)
  if (!info) throw new ParsePlatformError('invalid-url', '保利票务链接缺少有效的演出 ID')
  const normalized = parseHttpUrl(
    `https://${WEIXIN_HOST}${API_PATH_PREFIX}${info.productId}?source=true`,
  )
  if (!normalized) throw new ParsePlatformError('invalid-url', '无法规范化保利票务链接')
  return normalized
}

export function parsePolyResponse(payload: unknown): ParsePlatformResult {
  const root = asRecord(parseJsonValue(payload))
  const data = asRecord(root.data)
  const name = textValue(data.productName)
  if (root.success !== true || !name) {
    throw new ParsePlatformError('invalid-response', '保利票务接口没有返回有效的演出数据')
  }

  return {
    platformName: '保利票务',
    name,
    play: extractPlayTitle(name),
    startedAtMs: parseFirstPerformanceDate(textValue(data.showStartToEndTime)),
    city: removeCitySuffix(textValue(data.cityName)),
    venue: textValue(data.showPlaceName),
    artistNames: [],
    coverUrl: normalizeProtocolUrl(textValue(data.img)),
  }
}

function extractPolyLinkInfo(url: ParsePlatformUrl): PolyLinkInfo | null {
  if (url.protocol !== 'https:') return null

  const fragment = url.href.includes('#') ? url.href.slice(url.href.indexOf('#') + 1) : ''
  if (url.hostname === DESKTOP_HOST && url.pathname === '/') {
    if (!fragment.startsWith('/detail?')) return null
    const query = fragment.includes('?') ? fragment.slice(fragment.indexOf('?') + 1) : ''
    const productId = queryParam(query, 'productId')
    const theaterId = queryParam(query, 'theaterId')
    return isNumericId(productId) && isOptionalNumericId(theaterId)
      ? { productId, theaterId }
      : null
  }

  const isWeixinPath = url.hostname === WEIXIN_HOST && (url.pathname === '/' || url.pathname === '/thh5/')
  const isMobilePath = url.hostname === MOBILE_HOST && url.pathname === '/'
  if (!isWeixinPath && !isMobilePath) return null

  const match = /^\/projectdetail\/(\d+)\/[^/?#]+(?:\?([^#]*))?$/.exec(fragment)
  if (!match) return null
  const theaterId = queryParam(match[2] ?? '', 'theaterId')
  if (!isOptionalNumericId(theaterId)) return null
  return { productId: match[1], theaterId }
}

function queryParam(query: string, name: string): string | null {
  for (const component of query.split('&')) {
    if (!component) continue
    const separator = component.indexOf('=')
    const rawName = separator >= 0 ? component.slice(0, separator) : component
    if (decodeQueryComponent(rawName) !== name) continue
    return decodeQueryComponent(separator >= 0 ? component.slice(separator + 1) : '')
  }
  return null
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new ParsePlatformError('parsing-failed', '无法解析保利票务演出数据')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function extractPlayTitle(name: string): string {
  return name.match(/《([^》]+)》/)?.[1]?.trim() ?? ''
}

function removeCitySuffix(value: string): string {
  return value.endsWith('市') ? value.slice(0, -1) : value
}

function normalizeProtocolUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value
}

function isNumericId(value: string | null): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}

function isOptionalNumericId(value: string | null): boolean {
  return value === null || isNumericId(value)
}
