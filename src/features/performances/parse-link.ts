import type { Performance } from '@/domain/performance'
import type { PerformanceDraft } from '@/features/performances/repository'
import { ParsePlatformError, type ParsePlatformResult } from './parse-platform/types'
import { parseHttpUrl, type ParsePlatformUrl } from './parse-platform/url'

export const PARSE_LINK_FIELDS = [
  'poster',
  'name',
  'play',
  'date',
  'city',
  'venue',
  'artist',
] as const

export type ParseLinkField = typeof PARSE_LINK_FIELDS[number]

export const UNSUPPORTED_PARSE_LINK_MESSAGE = '暂不支持该链接'
export const PARSE_LINK_FAILED_MESSAGE = '解析失败'

export function extractFirstHttpUrl(value: string): ParsePlatformUrl | null {
  const match = value.match(/https?:\/\/[^\s<>"'`，。！？；：、（）【】《》「」『』()\[\]{}]+/i)
  if (!match) return null
  return parseHttpUrl(trimTrailingSharePunctuation(match[0]))
}

export function parseLinkErrorText(error: unknown): string {
  if (
    error instanceof ParsePlatformError
    && (error.code === 'unsupported-url' || error.code === 'invalid-url')
  ) return UNSUPPORTED_PARSE_LINK_MESSAGE
  return PARSE_LINK_FAILED_MESSAGE
}

export function availableParseLinkFields(result: ParsePlatformResult): ParseLinkField[] {
  return PARSE_LINK_FIELDS.filter((field) => {
    if (field === 'poster') return Boolean(result.coverUrl)
    if (field === 'name') return Boolean(result.name)
    if (field === 'play') return Boolean(result.play)
    if (field === 'date') return result.startedAtMs !== null
    if (field === 'city') return Boolean(result.city)
    if (field === 'venue') return Boolean(result.venue)
    return result.artistNames.length > 0
  })
}

export function applyParseLinkResult(
  destination: PerformanceDraft,
  result: ParsePlatformResult,
  fields: readonly ParseLinkField[],
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

  if (selected.has('name') && result.name) next.name = result.name
  if (selected.has('play') && result.play) next.facets.play = splitProtocolValues(result.play)
  if (selected.has('date') && result.startedAtMs !== null) next.startedAtMs = result.startedAtMs
  if (selected.has('city') && result.city) {
    next.city = result.city
    next.coordinate = null
  }
  if (selected.has('venue') && result.venue) {
    next.venue = result.venue
    next.coordinate = null
  }
  if (selected.has('artist') && result.artistNames.length) {
    next.facets.artist = uniqueText(result.artistNames)
  }
  return next
}

export function formatParsedDate(timestamp: number | null): string {
  if (timestamp === null) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function splitProtocolValues(value: string): string[] {
  return uniqueText(value.split('__PLAY__'))
}

function cloneFacets(facets: Performance['facets']): Performance['facets'] {
  return Object.fromEntries(
    Object.entries(facets).map(([kind, values]) => [kind, values ? [...values] : values]),
  ) as Performance['facets']
}

function uniqueText(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function trimTrailingSharePunctuation(value: string): string {
  return value.replace(/[,.!;:]+$/g, '')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
