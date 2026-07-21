import type { Performance } from '@/domain/performance'
import type { PerformanceDraft } from '@/features/performances/repository'

export const KOREAN_MUSICAL_SCHEDULE_FIELDS = [
  'name',
  'date',
  'play',
  'artist',
] as const

export type KoreanMusicalScheduleField = typeof KOREAN_MUSICAL_SCHEDULE_FIELDS[number]

export interface KoreanMusicalSchedule {
  id: string
  name: string
  startedAtMs: number
  time: string
  artists: string[]
  play: string
}

const REMOTE_URL = 'https://myukit.com/today'
const H5_PROXY_URL = '/myukit-proxy/today'

export class KoreanMusicalScheduleService {
  async searchByDate(date: string): Promise<KoreanMusicalSchedule[]> {
    const html = await requestScheduleHtml(date)
    return parseKoreanMusicalSchedules(html, date)
  }
}

export function applyKoreanMusicalSchedule(
  destination: PerformanceDraft,
  schedule: KoreanMusicalSchedule,
  fields: readonly KoreanMusicalScheduleField[],
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
  if (selected.has('play') && schedule.play.trim()) next.facets.play = [schedule.play.trim()]
  if (selected.has('artist') && schedule.artists.length) {
    next.facets.artist = uniqueText(schedule.artists)
  }
  return next
}

export function parseKoreanMusicalSchedules(
  html: string,
  requestedDate: string,
): KoreanMusicalSchedule[] {
  const schedules: KoreanMusicalSchedule[] = []
  const tables = html.matchAll(/<table\b[^>]*class=["'][^"']*\btoday-table\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi)

  for (const tableMatch of tables) {
    const table = tableMatch[1] ?? ''
    const timeContainer = matchClassElement(table, 'today-time-key')
    const time = htmlText(timeContainer).match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? ''
    const startedAtMs = parseLocalDateTime(`${requestedDate} ${time}`)
    if (startedAtMs === null) continue

    const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? ''
    for (const rowMatch of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = rowMatch[1] ?? ''
      const titleCell = matchClassElement(row, 'title')
      const rawName = htmlText(titleCell)
      if (!rawName) continue

      const play = rawName.split(/\s+-\s+/, 1)[0]?.trim() ?? rawName
      const castText = htmlText(matchClassElement(row, 'today-casts-list'))
      const artists = uniqueText(castText.split(',').map((item) => item.trim()))
      schedules.push(createSchedule({
        name: rawName,
        startedAtMs,
        time,
        artists,
        play,
      }))
    }
  }

  return schedules.sort((left, right) => left.startedAtMs - right.startedAtMs)
}

export function formatKoreanScheduleDate(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatKoreanScheduleDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${formatKoreanScheduleDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function requestScheduleHtml(date: string): Promise<string> {
  const platform = uni.getSystemInfoSync().uniPlatform
  const baseUrl = platform === 'app' ? REMOTE_URL : H5_PROXY_URL
  const url = `${baseUrl}?date=${encodeURIComponent(date)}`
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      dataType: 'text',
      timeout: 15_000,
      header: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
      },
      success: ({ statusCode, data }) => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`韩国音乐剧排期请求失败（${statusCode}）`))
          return
        }
        if (typeof data !== 'string') {
          reject(new Error('韩国音乐剧排期返回了无法识别的内容'))
          return
        }
        resolve(data)
      },
      fail: () => reject(new Error('无法连接韩国音乐剧排期服务')),
    })
  })
}

function createSchedule(value: Omit<KoreanMusicalSchedule, 'id'>): KoreanMusicalSchedule {
  const normalized = {
    ...value,
    name: value.name.trim(),
    time: value.time.trim(),
    artists: uniqueText(value.artists),
    play: value.play.trim(),
  }
  return {
    ...normalized,
    id: [
      normalized.startedAtMs,
      normalized.name,
      normalized.artists.join('|'),
    ].join('::'),
  }
}

function matchClassElement(html: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  )
  return html.match(pattern)?.[2] ?? ''
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

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
