import { parseFirstPerformanceDate } from './date'
import { defaultParsePlatformHttpClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import type { ParsePlatformUrl } from './url'

const GEWARA_HOST = 'www.gewara.com'
const MAOYAN_HOST = 'show.maoyan.com'

export class MaoyanParser implements ParsePlatformParser {
  readonly platformName = '猫眼'

  constructor(
    private readonly httpClient: ParsePlatformHttpClient = defaultParsePlatformHttpClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return maoyanPerformanceId(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    const normalizedUrl = normalizeMaoyanUrl(url)
    const html = await this.httpClient.getText(normalizedUrl)
    return parseMaoyanHtml(html)
  }
}

export function normalizeMaoyanUrl(url: ParsePlatformUrl): ParsePlatformUrl {
  if (url.protocol !== 'https:') {
    throw new ParsePlatformError('invalid-url', '猫眼链接必须使用 HTTPS')
  }

  const performanceId = maoyanPerformanceId(url)
  if (!performanceId) {
    throw new ParsePlatformError('invalid-url', '猫眼链接缺少有效的演出 ID')
  }

  return {
    href: `https://${GEWARA_HOST}/detail/${performanceId}`,
    protocol: 'https:',
    hostname: GEWARA_HOST,
    pathname: `/detail/${performanceId}`,
    search: '',
  }
}

export function parseMaoyanHtml(html: string): ParsePlatformResult {
  const payload = parseNextData(html)
  const props = asRecord(asRecord(payload).props)
  const pageProps = asRecord(props.pageProps)
  const detail = asRecord(pageProps.detail)
  const name = textValue(detail.name)
  if (!name) throw new ParsePlatformError('invalid-response', '猫眼页面缺少演出名称')

  return {
    platformName: '猫眼',
    name,
    play: extractPlayTitle(name),
    startedAtMs: parseFirstPerformanceDate(textValue(detail.showTimeRange)),
    city: textValue(detail.cityName),
    venue: textValue(detail.shopName),
    artistNames: [],
    coverUrl: normalizeProtocolUrl(textValue(detail.posterUrl)),
  }
}

function maoyanPerformanceId(url: ParsePlatformUrl): string | null {
  if (url.protocol !== 'https:') return null

  if (url.hostname === GEWARA_HOST) {
    return /^\/detail\/(\d+)\/?$/.exec(url.pathname)?.[1] ?? null
  }

  if (url.hostname !== MAOYAN_HOST || !/^\/qqw\/?$/.test(url.pathname) || url.search) {
    return null
  }
  const hashIndex = url.href.indexOf('#')
  if (hashIndex < 0) return null
  return /^#\/detail\/(\d+)\/?(?:\?.*)?$/.exec(url.href.slice(hashIndex))?.[1] ?? null
}

function parseNextData(html: string): unknown {
  const scripts = html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scripts) {
    const script = match[1]
    const markerIndex = script.indexOf('__NEXT_DATA__')
    if (markerIndex < 0) continue
    const objectStart = script.indexOf('{', markerIndex)
    if (objectStart < 0) break
    const objectEnd = findJsonObjectEnd(script, objectStart)
    if (objectEnd < 0) break
    try {
      return JSON.parse(script.slice(objectStart, objectEnd)) as unknown
    } catch {
      throw new ParsePlatformError('parsing-failed', '无法解析猫眼演出数据')
    }
  }
  throw new ParsePlatformError('invalid-response', '猫眼页面中没有演出数据')
}

function findJsonObjectEnd(value: string, start: number): number {
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

function extractPlayTitle(name: string): string {
  return name.match(/《([^》]+)》/)?.[1]?.trim() ?? ''
}

function normalizeProtocolUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
