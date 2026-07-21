import type { Performance } from '@/domain/performance'
import type { PerformanceDraft } from '@/features/performances/repository'

export const CHINESE_MUSICAL_SCHEDULE_FIELDS = [
  'name',
  'date',
  'city',
  'venue',
  'play',
  'artist',
] as const

export type ChineseMusicalScheduleField = typeof CHINESE_MUSICAL_SCHEDULE_FIELDS[number]

export interface ChineseMusicalSchedule {
  id: string
  name: string
  startedAtMs: number
  city: string
  venue: string
  artists: string[]
  play: string
}

export interface ChineseMusicalArtist {
  name: string
  path: string
}

interface CastMember {
  role: string
  artist: string
}

interface DayShowResponse {
  date: string
  city: string
  show_list: Array<{
    musical: string
    time: string
    theatre: string
    cast: CastMember[]
  }>
}

interface PlayShowResponse {
  show_list: Array<{
    city: string
    time: string
    theatre: string
    cast: CastMember[]
  }>
}

const REMOTE_BASE_URL = 'https://y.saoju.net'
const H5_PROXY_BASE_URL = '/yyj-proxy'

export class ChineseMusicalScheduleService {
  async searchByDay(date: string, city: string): Promise<ChineseMusicalSchedule[]> {
    const data = await requestJson('/yyj/api/search_day/', { date, city })
    return parseDayScheduleResponse(data, date, city)
  }

  async searchByPlay(
    play: string,
    beginDate: string,
    endDate: string,
  ): Promise<ChineseMusicalSchedule[]> {
    const data = await requestJson('/yyj/api/search_musical_show/', {
      musical: play,
      begin_date: beginDate,
      end_date: endDate,
    })
    return parsePlayScheduleResponse(data, play)
  }

  async searchArtists(name: string): Promise<ChineseMusicalArtist[]> {
    const html = await requestText('/yyj/search/', { q: name })
    return parseChineseMusicalArtists(html)
  }

  async searchByArtist(artist: ChineseMusicalArtist): Promise<ChineseMusicalSchedule[]> {
    if (!isAllowedArtistPath(artist.path)) throw new Error('演员排期地址不受支持')
    const html = await requestText(artist.path, { other: '1', musical: '' })
    return parseChineseMusicalArtistSchedules(html, artist.name)
  }
}

export function applyChineseMusicalSchedule(
  destination: PerformanceDraft,
  schedule: ChineseMusicalSchedule,
  fields: readonly ChineseMusicalScheduleField[],
): PerformanceDraft {
  const selected = new Set(fields)
  const next: PerformanceDraft = {
    ...destination,
    ticketPrice: { ...destination.ticketPrice },
    paidPrice: { ...destination.paidPrice },
    otherCost: { ...destination.otherCost },
    coordinate: destination.coordinate ? { ...destination.coordinate } : null,
    tagIds: [...destination.tagIds],
    facets: cloneFacets(destination.facets),
    mediaAssets: destination.mediaAssets.map((asset) => ({ ...asset })),
  }

  if (selected.has('name') && schedule.name.trim()) next.name = schedule.name.trim()
  if (selected.has('date')) next.startedAtMs = schedule.startedAtMs
  if (selected.has('city') && schedule.city.trim()) {
    next.city = schedule.city.trim()
    next.coordinate = null
  }
  if (selected.has('venue') && schedule.venue.trim()) {
    next.venue = schedule.venue.trim()
    next.coordinate = null
  }
  if (selected.has('play') && schedule.play.trim()) next.facets.play = [schedule.play.trim()]
  if (selected.has('artist') && schedule.artists.length) {
    next.facets.artist = uniqueText(schedule.artists)
  }
  return next
}

export function parseDayScheduleResponse(
  value: unknown,
  requestedDate: string,
  requestedCity: string,
): ChineseMusicalSchedule[] {
  const response = decodeDayResponse(value)
  const date = response.date || requestedDate
  const city = response.city || requestedCity
  return response.show_list.flatMap((show) => {
    const startedAtMs = parseLocalDateTime(`${date} ${show.time}`)
    if (startedAtMs === null) return []
    return [createSchedule({
      name: show.musical,
      startedAtMs,
      city,
      venue: show.theatre,
      artists: show.cast.map(({ artist }) => artist),
      play: show.musical,
    })]
  })
}

export function parsePlayScheduleResponse(value: unknown, play: string): ChineseMusicalSchedule[] {
  const response = decodePlayResponse(value)
  return response.show_list.flatMap((show) => {
    const startedAtMs = parseLocalDateTime(show.time)
    if (startedAtMs === null) return []
    return [createSchedule({
      name: play,
      startedAtMs,
      city: show.city,
      venue: show.theatre,
      artists: show.cast.map(({ artist }) => artist),
      play,
    })]
  })
}

export function parseChineseMusicalArtists(html: string): ChineseMusicalArtist[] {
  const results: ChineseMusicalArtist[] = []
  const links = html.matchAll(/<a\b[^>]*href=["'](\/yyj\/artist\/\d+\/)["'][^>]*>([\s\S]*?)<\/a>/gi)
  for (const match of links) {
    const name = htmlText(match[2] ?? '')
    const path = match[1] ?? ''
    if (name && isAllowedArtistPath(path)) results.push({ name, path })
  }
  return deduplicateBy(results, ({ path }) => path)
}

export function parseChineseMusicalArtistSchedules(
  html: string,
  artistName: string,
  referenceDate = new Date(),
): ChineseMusicalSchedule[] {
  const tableBody = html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? ''
  const rows = tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)
  const results: ChineseMusicalSchedule[] = []
  for (const row of rows) {
    const cells = [...(row[1] ?? '').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => match[1] ?? '')
    if (cells.length < 5) continue

    const rawTime = htmlText(cells[0])
    const timeMatch = rawTime.match(/(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})/)
    if (!timeMatch) continue
    const [, month, day, time] = timeMatch
    const year = referenceDate.getFullYear()
    const startedAtMs = parseLocalDateTime(`${year}-${pad(Number(month))}-${pad(Number(day))} ${time}`)
    if (startedAtMs === null) continue

    const play = htmlText(cells[1])
    const coArtists = extractAnchorTexts(cells[3])
    const locations = extractAnchorTexts(cells[4])
    const locationText = htmlText(cells[4]).split(/\s+/).filter(Boolean)
    const city = locations[0] ?? locationText[0] ?? ''
    const venue = locations[1] ?? locationText.slice(1).join(' ')
    if (!play || !city || !venue) continue

    results.push(createSchedule({
      name: play,
      startedAtMs,
      city,
      venue,
      artists: uniqueText([artistName, ...coArtists]),
      play,
    }))
  }
  return results
}

export function formatScheduleDate(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatScheduleDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${formatScheduleDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function createSchedule(value: Omit<ChineseMusicalSchedule, 'id'>): ChineseMusicalSchedule {
  const normalized = {
    ...value,
    name: value.name.trim(),
    city: value.city.trim(),
    venue: value.venue.trim(),
    artists: uniqueText(value.artists),
    play: value.play.trim(),
  }
  return {
    ...normalized,
    id: [
      normalized.startedAtMs,
      normalized.city,
      normalized.venue,
      normalized.play,
      normalized.artists.join('|'),
    ].join('::'),
  }
}

function decodeDayResponse(value: unknown): DayShowResponse {
  const record = asRecord(parsePossibleJson(value))
  return {
    date: textValue(record.date),
    city: textValue(record.city),
    show_list: arrayValue(record.show_list).map(decodeDayShow).filter(isPresent),
  }
}

function decodePlayResponse(value: unknown): PlayShowResponse {
  const record = asRecord(parsePossibleJson(value))
  return {
    show_list: arrayValue(record.show_list).map(decodePlayShow).filter(isPresent),
  }
}

function decodeDayShow(value: unknown): DayShowResponse['show_list'][number] | null {
  const record = asRecord(value)
  const musical = textValue(record.musical)
  const time = textValue(record.time)
  const theatre = textValue(record.theatre)
  if (!musical || !time || !theatre) return null
  return { musical, time, theatre, cast: decodeCast(record.cast) }
}

function decodePlayShow(value: unknown): PlayShowResponse['show_list'][number] | null {
  const record = asRecord(value)
  const city = textValue(record.city)
  const time = textValue(record.time)
  const theatre = textValue(record.theatre)
  if (!city || !time || !theatre) return null
  return { city, time, theatre, cast: decodeCast(record.cast) }
}

function decodeCast(value: unknown): CastMember[] {
  return arrayValue(value).flatMap((item) => {
    const record = asRecord(item)
    const artist = textValue(record.artist)
    if (!artist) return []
    return [{ role: textValue(record.role), artist }]
  })
}

async function requestJson(path: string, query: Record<string, string>): Promise<unknown> {
  return request(path, query, 'json')
}

async function requestText(path: string, query: Record<string, string>): Promise<string> {
  const value = await request(path, query, 'text')
  if (typeof value !== 'string') throw new Error('排期服务返回了无法识别的内容')
  return value
}

async function request(
  path: string,
  query: Record<string, string>,
  dataType: 'json' | 'text',
): Promise<unknown> {
  const url = buildRequestUrl(path, query)
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      dataType,
      timeout: 15_000,
      header: { Accept: dataType === 'json' ? 'application/json' : 'text/html' },
      success: ({ statusCode, data }) => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`排期服务请求失败（${statusCode}）`))
          return
        }
        resolve(data)
      },
      fail: () => reject(new Error('无法连接中文音乐剧排期服务')),
    })
  })
}

function buildRequestUrl(path: string, query: Record<string, string>): string {
  const platform = uni.getSystemInfoSync().uniPlatform
  const baseUrl = platform === 'app' ? REMOTE_BASE_URL : H5_PROXY_BASE_URL
  const parameters = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${baseUrl}${path}?${parameters}`
}

function isAllowedArtistPath(path: string): boolean {
  return /^\/yyj\/artist\/\d+\/$/.test(path)
}

function parseLocalDateTime(value: string): number | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/)
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
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

function extractAnchorTexts(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => htmlText(match[1] ?? ''))
    .filter(Boolean)
}

function htmlText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim()
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

function cloneFacets(facets: Performance['facets']): Performance['facets'] {
  return Object.fromEntries(
    Object.entries(facets).map(([kind, values]) => [kind, values ? [...values] : values]),
  ) as Performance['facets']
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error('排期服务返回了无法识别的数据')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function deduplicateBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const result = key(value)
    if (seen.has(result)) return false
    seen.add(result)
    return true
  })
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
