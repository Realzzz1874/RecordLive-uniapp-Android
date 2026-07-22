import { parseFirstPerformanceDate } from './date'
import { defaultParsePlatformJsonClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformJsonClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { parseHttpUrl, type ParsePlatformUrl, urlSearchParam } from './url'

const OFFICIAL_HOST = 'www.bjconcerthall.cn'
const MAITIX_HOST = 'bjyyt.maitix.com'
const DETAIL_PATH = '/bjyyt/ycgp/ycgpxq.shtml'

export class BjConcertHallParser implements ParsePlatformParser {
  readonly platformName = '北京音乐厅'

  constructor(
    private readonly jsonClient: ParsePlatformJsonClient = defaultParsePlatformJsonClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return bjConcertHallProjectId(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    const projectId = bjConcertHallProjectId(url)
    if (!projectId) throw new ParsePlatformError('invalid-url', '北京音乐厅链接缺少有效的演出 ID')

    const [project, events] = await Promise.all([
      this.jsonClient.getJson(apiUrl(`/yjzd-webapp/api/project/detail?projectId=${projectId}`)),
      this.jsonClient.getJson(apiUrl(`/yjzd-webapp/api/event/list?projectId=${projectId}`)),
    ])
    return parseBjConcertHallResponses(project, events)
  }
}

export function parseBjConcertHallResponses(
  projectPayload: unknown,
  eventPayload: unknown,
): ParsePlatformResult {
  const projectRoot = asRecord(parseJson(projectPayload))
  const eventRoot = asRecord(parseJson(eventPayload))
  const project = asRecord(projectRoot.data)
  const name = text(project.projectName) || text(project.name)
  if (!isSuccess(projectRoot.code) || !isSuccess(eventRoot.code) || !name) {
    throw new ParsePlatformError('invalid-response', '北京音乐厅接口没有返回有效的演出数据')
  }

  const dates = array(eventRoot.data)
    .map((item) => {
      const event = asRecord(item)
      return parseFirstPerformanceDate(text(event.eventStartTime) || text(event.startTime))
    })
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)

  return {
    platformName: '北京音乐厅',
    name,
    play: extractPlayTitles(name),
    startedAtMs: dates[0] ?? null,
    city: '北京',
    venue: '北京音乐厅',
    artistNames: [],
    coverUrl: normalizeProtocolUrl(
      text(project.projectImgUrl) || text(project.projectImg) || text(project.img),
    ),
  }
}

function bjConcertHallProjectId(url: ParsePlatformUrl): string | null {
  if (url.protocol !== 'https:') return null
  if (url.hostname === OFFICIAL_HOST && url.pathname === DETAIL_PATH) {
    return numericId(urlSearchParam(url, 'projectId'))
  }
  if (url.hostname !== MAITIX_HOST || url.pathname !== '/h5') return null
  const fragment = fragmentValue(url)
  const match = /^\/pages-order\/projectDetail\/index\?([^#]+)$/.exec(fragment)
  return numericId(match ? queryParam(match[1], 'projectId') : null)
}

function apiUrl(path: string): ParsePlatformUrl {
  const value = parseHttpUrl(`https://${OFFICIAL_HOST}${path}`)
  if (!value) throw new ParsePlatformError('invalid-url', '无法生成北京音乐厅接口地址')
  return value
}

function fragmentValue(url: ParsePlatformUrl): string {
  const index = url.href.indexOf('#')
  return index >= 0 ? url.href.slice(index + 1) : ''
}

function queryParam(query: string, name: string): string | null {
  for (const component of query.split('&')) {
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

function numericId(value: string | null): string | null {
  return value && /^\d+$/.test(value) ? value : null
}

function extractPlayTitles(name: string): string {
  return [...name.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim()).filter(Boolean).join('__PLAY__')
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
    throw new ParsePlatformError('parsing-failed', '无法解析北京音乐厅演出数据')
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
