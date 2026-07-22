import { defaultParsePlatformHttpClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { type ParsePlatformUrl, urlSearchParam } from './url'

const DETAIL_HOST = 'm.shcstheatre.com'
const DETAIL_PATH = '/Program/ProgramDetailsWeChat.aspx'
const COVER_HOST = 'pic.shcstheatre.com'

export class ShcstheatreParser implements ParsePlatformParser {
  readonly platformName = '上海文化广场'

  constructor(
    private readonly httpClient: ParsePlatformHttpClient = defaultParsePlatformHttpClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return shcstheatreProgramId(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    const normalizedUrl = normalizeShcstheatreUrl(url)
    const html = await this.httpClient.getText(normalizedUrl)
    return parseShcstheatreHtml(html)
  }
}

export function normalizeShcstheatreUrl(url: ParsePlatformUrl): ParsePlatformUrl {
  if (url.protocol !== 'https:') {
    throw new ParsePlatformError('invalid-url', '上海文化广场链接必须使用 HTTPS')
  }

  const programId = shcstheatreProgramId(url)
  if (!programId) {
    throw new ParsePlatformError('invalid-url', '上海文化广场链接缺少有效的演出 ID')
  }

  const search = `?id=${programId}&headtype=YanChu&ARTICLE_ID=${programId}`
  return {
    href: `https://${DETAIL_HOST}${DETAIL_PATH}${search}`,
    protocol: 'https:',
    hostname: DETAIL_HOST,
    pathname: DETAIL_PATH,
    search,
  }
}

export function parseShcstheatreHtml(html: string): ParsePlatformResult {
  const script = findProgramScript(html)
  if (!script) {
    throw new ParsePlatformError('invalid-response', '上海文化广场页面中没有演出数据')
  }

  const name = jsonStringValue(script, 'SCS_WEB_BRIEFNAME')
  if (!name) {
    throw new ParsePlatformError('invalid-response', '上海文化广场页面缺少演出名称')
  }

  const ground = jsonStringValue(script, 'I_GROUND_ID_NAME')
  const stage = jsonStringValue(script, 'VC_VENUE_IDNAME')
  const rawCover = jsonStringValue(script, 'SCS_MOBILE_YMXQ_PIC').split(';')[0]?.trim() ?? ''

  return {
    platformName: '上海文化广场',
    name,
    play: extractPlayTitle(name),
    startedAtMs: null,
    city: '上海',
    venue: joinVenue(ground, stage),
    artistNames: [],
    coverUrl: normalizeCoverUrl(rawCover),
  }
}

function shcstheatreProgramId(url: ParsePlatformUrl): string | null {
  if (url.protocol !== 'https:' || url.hostname !== DETAIL_HOST || url.pathname !== DETAIL_PATH) {
    return null
  }

  const articleId = urlSearchParam(url, 'ARTICLE_ID')
  const id = urlSearchParam(url, 'id')
  if (articleId && id && articleId !== id) return null
  const programId = articleId ?? id
  return isProgramId(programId) ? programId : null
}

function findProgramScript(html: string): string {
  const scripts = html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scripts) {
    if (/"SCS_WEB_BRIEFNAME"\s*:\s*"/.test(match[1])) return match[1]
  }
  return ''
}

function jsonStringValue(source: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`"${escapedKey}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`).exec(source)
  if (!match) return ''
  try {
    const value = JSON.parse(match[1]) as unknown
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    throw new ParsePlatformError('parsing-failed', `无法解析上海文化广场${key}字段`)
  }
}

function joinVenue(ground: string, stage: string): string {
  if (!ground) return stage
  return stage ? `${ground}·${stage}` : ground
}

function normalizeCoverUrl(value: string): string {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${COVER_HOST}/${value.replace(/^\/+/, '')}`
}

function extractPlayTitle(name: string): string {
  return name.match(/《([^》]+)》/)?.[1]?.trim() ?? ''
}

function isProgramId(value: string | null): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}
