import { defaultParsePlatformHttpClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import { type ParsePlatformUrl, urlSearchParam } from './url'

const DESKTOP_HOST = 'www.showstart.com'
const MOBILE_HOST = 'wap.showstart.com'
const MOBILE_PATH = '/pages/activity/detail/detail'

export class ShowstartParser implements ParsePlatformParser {
  readonly platformName = '秀动'

  constructor(
    private readonly httpClient: ParsePlatformHttpClient = defaultParsePlatformHttpClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return showstartActivityId(url) !== null
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    const normalizedUrl = normalizeShowstartUrl(url)
    const html = await this.httpClient.getText(normalizedUrl)
    return parseShowstartHtml(html)
  }
}

export function normalizeShowstartUrl(url: ParsePlatformUrl): ParsePlatformUrl {
  if (url.protocol !== 'https:') {
    throw new ParsePlatformError('invalid-url', '秀动链接必须使用 HTTPS')
  }

  const activityId = showstartActivityId(url)
  if (!activityId) {
    throw new ParsePlatformError('invalid-url', '秀动链接缺少有效的演出 ID')
  }

  return {
    href: `https://${DESKTOP_HOST}/event/${activityId}`,
    protocol: 'https:',
    hostname: DESKTOP_HOST,
    pathname: `/event/${activityId}`,
    search: '',
  }
}

export function parseShowstartHtml(html: string): ParsePlatformResult {
  const nuxtPayload = extractNuxtPayload(html)
  const detail = extractBalancedValue(nuxtPayload, 'detail:', '{', '}')
  if (!detail) {
    throw new ParsePlatformError('invalid-response', '秀动页面中没有演出数据')
  }

  const name = extractJsString(detail, 'title')
  if (!name) throw new ParsePlatformError('invalid-response', '秀动页面缺少演出名称')

  const performers = extractBalancedValue(detail, 'performers:', '[', ']')
  const site = extractBalancedValue(detail, 'site:', '{', '}')
  const showTime = extractJsString(detail, 'showTime')

  return {
    platformName: '秀动',
    name,
    play: extractPlayTitle(name),
    startedAtMs: parseShowstartDate(showTime, detail),
    city: site ? extractJsString(site, 'cityName') : '',
    venue: site ? extractJsString(site, 'name') : '',
    artistNames: performers ? extractUniqueNames(performers) : [],
    coverUrl: normalizeProtocolUrl(extractJsString(detail, 'poster')),
  }
}

function showstartActivityId(url: ParsePlatformUrl): string | null {
  if (url.protocol !== 'https:') return null

  if (url.hostname === DESKTOP_HOST) {
    return /^\/event\/(\d+)\/?$/.exec(url.pathname)?.[1] ?? null
  }

  if (url.hostname === MOBILE_HOST && url.pathname === MOBILE_PATH) {
    const activityId = urlSearchParam(url, 'activityId')
    return isActivityId(activityId) ? activityId : null
  }

  return null
}

function extractNuxtPayload(html: string): string {
  const markerIndex = html.indexOf('window.__NUXT__')
  if (markerIndex < 0) {
    throw new ParsePlatformError('invalid-response', '秀动页面中没有演出数据')
  }
  const scriptEnd = html.indexOf('</script>', markerIndex)
  return html.slice(markerIndex, scriptEnd >= 0 ? scriptEnd : undefined)
}

function extractBalancedValue(
  source: string,
  marker: string,
  openCharacter: string,
  closeCharacter: string,
): string {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return ''
  const start = source.indexOf(openCharacter, markerIndex + marker.length)
  if (start < 0) return ''

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === openCharacter) depth += 1
    else if (character === closeCharacter && --depth === 0) return source.slice(start, index + 1)
  }
  return ''
}

function extractJsString(source: string, property: string): string {
  const marker = `${property}:`
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return ''
  const quoteIndex = source.indexOf('"', markerIndex + marker.length)
  if (quoteIndex < 0) return ''

  let escaped = false
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const character = source[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (character !== '"') continue

    try {
      return JSON.parse(source.slice(quoteIndex, index + 1)) as string
    } catch {
      throw new ParsePlatformError('parsing-failed', `无法解析秀动${property}字段`)
    }
  }
  return ''
}

function extractUniqueNames(performers: string): string[] {
  const names: string[] = []
  let remaining = performers
  while (remaining) {
    const performerStart = remaining.indexOf('{')
    if (performerStart < 0) break
    const performer = extractBalancedFrom(remaining, performerStart, '{', '}')
    if (!performer) break
    const name = extractJsString(performer, 'name')
    if (name && !names.includes(name)) names.push(name)
    remaining = remaining.slice(performerStart + performer.length)
  }
  return names
}

function extractBalancedFrom(
  source: string,
  start: number,
  openCharacter: string,
  closeCharacter: string,
): string {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === openCharacter) depth += 1
    else if (character === closeCharacter && --depth === 0) return source.slice(start, index + 1)
  }
  return ''
}

function parseShowstartDate(showTime: string, detail: string): number | null {
  const match = showTime.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/)
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  const hour = Number(match[3])
  const minute = Number(match[4])
  const year = inferPerformanceYear(detail, month, day) ?? new Date().getFullYear()
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

function inferPerformanceYear(detail: string, month: number, day: number): number | null {
  const endTimes = detail.matchAll(/endTime:"(\d{4})-(\d{2})-(\d{2})\s/g)
  for (const match of endTimes) {
    if (Number(match[2]) === month && Number(match[3]) === day) return Number(match[1])
  }
  return null
}

function extractPlayTitle(name: string): string {
  return name.match(/《([^》]+)》/)?.[1]?.trim() ?? ''
}

function normalizeProtocolUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value
}

function isActivityId(value: string | null): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}
