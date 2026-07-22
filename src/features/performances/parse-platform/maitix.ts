import { defaultParsePlatformJsonClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformJsonClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { parseHttpUrl, type ParsePlatformUrl } from './url'

const API_HOST = 'client.maitix.com'
const CADXY_HOST = 'www.cadxy.cn'

interface MaitixLinkInfo {
  projectId: string
  sourceHost: string
  sourceOrigin: string
}

export class MaitixParser implements ParsePlatformParser {
  readonly platformName = '剧院票务'

  constructor(
    private readonly jsonClient: ParsePlatformJsonClient = defaultParsePlatformJsonClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return maitixLinkInfo(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    const info = maitixLinkInfo(url)
    if (!info) throw new ParsePlatformError('invalid-url', '剧院票务链接缺少有效的演出 ID')

    const api = parseHttpUrl(
      `https://${API_HOST}/api/pro/project?projectToken=${info.projectId}&reqType=1`,
    )
    if (!api) throw new ParsePlatformError('invalid-url', '无法生成剧院票务接口地址')
    const payload = await this.jsonClient.getJson(api, {
      Origin: info.sourceOrigin,
      Referer: `${info.sourceOrigin}/`,
      'X-Parse-Origin': info.sourceOrigin,
    })
    const result = parseMaitixResponse(payload)
    return {
      ...result,
      platformName: maitixPlatformName(info.sourceHost, result.venue, result.name),
    }
  }
}

export function parseMaitixResponse(payload: unknown): ParsePlatformResult {
  const root = asRecord(parseJson(payload))
  const data = asRecord(root.data)
  const name = text(data.projectName) || text(data.name)
  if (!isSuccess(root.code) || !name) {
    throw new ParsePlatformError('invalid-response', '剧院票务接口没有返回有效的演出数据')
  }

  const eventDates = array(data.eventVoList)
    .map((item) => timestamp(asRecord(item).showTime) ?? timestamp(asRecord(item).startTime))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)

  const venue = text(data.siteName) || text(data.siteAddress)
  return {
    platformName: maitixPlatformName('', venue, name),
    name,
    play: extractPlayTitles(name),
    startedAtMs: eventDates[0] ?? timestamp(data.startTime),
    city: removeCitySuffix(text(data.cityName) || text(data.city)),
    venue,
    artistNames: [],
    coverUrl: normalizeProtocolUrl(
      text(data.imgUrl) || text(data.projectImg) || text(data.img) || text(data.shareImg),
    ),
  }
}

function maitixLinkInfo(url: ParsePlatformUrl): MaitixLinkInfo | null {
  if (url.protocol !== 'https:' || !isMaitixHost(url.hostname)) return null
  const fragmentIndex = url.href.indexOf('#')
  if (fragmentIndex < 0) return null
  const fragment = url.href.slice(fragmentIndex + 1)
  const match = /^\/pages-order\/projectDetail\/index\?([^#]+)$/.exec(fragment)
  if (!match) return null
  const projectId = queryParam(match[1], 'projectId')
  if (!projectId || !/^\d+$/.test(projectId)) return null
  return {
    projectId,
    sourceHost: url.hostname,
    sourceOrigin: `https://${url.hostname}`,
  }
}

function maitixPlatformName(sourceHost: string, venue: string, name: string): string {
  if (sourceHost === 'tjyrwh.maitix.com') return '天津中华剧院'
  if (sourceHost === CADXY_HOST) return '北京长安大戏院'

  const searchable = `${venue} ${name}`
  if (searchable.includes('中华剧院')) return '天津中华剧院'
  if (searchable.includes('吉祥大戏院')) return '北京吉祥大戏院'
  if (searchable.includes('长安大戏院')) return '北京长安大戏院'
  if (searchable.includes('北京人民剧场')) return '北京人民剧场'
  if (searchable.includes('梅兰芳大剧院')) return '北京梅兰芳大剧院'
  if (
    searchable.includes('北京人艺')
    || searchable.includes('首都剧场')
    || searchable.includes('曹禺剧场')
    || searchable.includes('人艺实验剧场')
  ) return '北京人艺票务中心'
  return venue || '剧院票务'
}

function isMaitixHost(hostname: string): boolean {
  return hostname === 'maitix.com' || hostname.endsWith('.maitix.com') || hostname === CADXY_HOST
}

function queryParam(query: string, name: string): string | null {
  for (const component of query.split('&')) {
    if (!component) continue
    const separator = component.indexOf('=')
    const key = separator >= 0 ? component.slice(0, separator) : component
    if (decode(key) !== name) continue
    return decode(separator >= 0 ? component.slice(separator + 1) : '')
  }
  return null
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

function timestamp(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  return number < 10_000_000_000 ? number * 1000 : number
}

function extractPlayTitles(name: string): string {
  return [...name.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim()).filter(Boolean).join('__PLAY__')
}

function removeCitySuffix(value: string): string {
  return value.endsWith('市') ? value.slice(0, -1) : value
}

function normalizeProtocolUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value
}

function isSuccess(value: unknown): boolean {
  return value === 200 || value === '200'
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new ParsePlatformError('parsing-failed', '无法解析剧院票务演出数据')
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
