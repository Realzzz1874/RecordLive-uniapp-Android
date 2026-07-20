import type { PerformanceLifecycle } from '@/domain/performance'

export type PerformanceDisplayMode = 'card' | 'poster'

export interface PerformanceFilter {
  categoryIds: string[]
  tagIds: string[]
  year: number | null
  lifecycles: PerformanceLifecycle[]
}

export interface PerformanceBrowsePreferences {
  displayMode: PerformanceDisplayMode
  posterColumnCount: number
  filter: PerformanceFilter
}

export const ALL_PERFORMANCE_LIFECYCLES: readonly PerformanceLifecycle[] = [
  'attended',
  'upcoming',
  'pending-sale',
  'cancelled',
  'missed',
] as const

export const DEFAULT_BROWSE_PREFERENCES: PerformanceBrowsePreferences = {
  displayMode: 'card',
  posterColumnCount: 4,
  filter: {
    categoryIds: [],
    tagIds: [],
    year: null,
    lifecycles: [...ALL_PERFORMANCE_LIFECYCLES],
  },
}

export function normalizeBrowsePreferences(value: unknown): PerformanceBrowsePreferences {
  if (!isRecord(value)) return cloneBrowsePreferences(DEFAULT_BROWSE_PREFERENCES)
  const rawFilter = isRecord(value.filter) ? value.filter : {}
  const displayMode = value.displayMode === 'poster' ? 'poster' : 'card'
  const posterColumnCount = normalizePosterColumnCount(value.posterColumnCount)
  const year = Number.isSafeInteger(rawFilter.year) && Number(rawFilter.year) >= 1970
    ? Number(rawFilter.year)
    : null
  const lifecycles = uniqueStrings(rawFilter.lifecycles).filter(isPerformanceLifecycle)

  return {
    displayMode,
    posterColumnCount,
    filter: {
      categoryIds: uniqueStrings(rawFilter.categoryIds),
      tagIds: uniqueStrings(rawFilter.tagIds),
      year,
      lifecycles: Array.isArray(rawFilter.lifecycles)
        ? lifecycles
        : [...ALL_PERFORMANCE_LIFECYCLES],
    },
  }
}

export function cloneBrowsePreferences(
  value: PerformanceBrowsePreferences,
): PerformanceBrowsePreferences {
  return {
    displayMode: value.displayMode,
    posterColumnCount: value.posterColumnCount,
    filter: {
      categoryIds: [...value.filter.categoryIds],
      tagIds: [...value.filter.tagIds],
      year: value.filter.year,
      lifecycles: [...value.filter.lifecycles],
    },
  }
}

export const POSTER_COLUMN_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const

export function normalizePosterColumnCount(value: unknown): number {
  return POSTER_COLUMN_COUNTS.includes(value as typeof POSTER_COLUMN_COUNTS[number])
    ? Number(value)
    : DEFAULT_BROWSE_PREFERENCES.posterColumnCount
}

export function yearRange(year: number | null): {
  startedFromMs?: number
  startedToMs?: number
} {
  if (year === null) return {}
  return {
    startedFromMs: new Date(year, 0, 1).getTime(),
    startedToMs: new Date(year + 1, 0, 1).getTime() - 1,
  }
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(
    (item) => item.trim(),
  ).filter(Boolean))]
}

function isPerformanceLifecycle(value: string): value is PerformanceLifecycle {
  return ALL_PERFORMANCE_LIFECYCLES.includes(value as PerformanceLifecycle)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
