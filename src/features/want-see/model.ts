import type { PerformanceQuery } from '@/features/performances/repository'
import type { PerformanceDisplayMode } from '@/features/preferences/model'

export type WantSeeDisplayMode = Extract<
  PerformanceDisplayMode,
  'card' | 'simple' | 'timeline'
>

export interface WantSeePreferences {
  displayMode: WantSeeDisplayMode
  includePendingSale: boolean
}

export const DEFAULT_WANT_SEE_PREFERENCES: WantSeePreferences = {
  displayMode: 'card',
  includePendingSale: true,
}

export function normalizeWantSeePreferences(value: unknown): WantSeePreferences {
  if (!isRecord(value)) return { ...DEFAULT_WANT_SEE_PREFERENCES }
  return {
    displayMode: isWantSeeDisplayMode(value.displayMode) ? value.displayMode : 'card',
    includePendingSale: typeof value.includePendingSale === 'boolean'
      ? value.includePendingSale
      : true,
  }
}

export function createWantSeeQuery(
  includePendingSale: boolean,
  referenceTimeMs: number,
  search = '',
): PerformanceQuery {
  return {
    search,
    lifecycles: includePendingSale ? ['upcoming', 'pending-sale'] : ['upcoming'],
    referenceTimeMs,
    startedFromMs: referenceTimeMs + 1,
    sortDirection: 'ascending',
  }
}

function isWantSeeDisplayMode(value: unknown): value is WantSeeDisplayMode {
  return value === 'card' || value === 'simple' || value === 'timeline'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
