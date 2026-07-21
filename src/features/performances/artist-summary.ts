import type { Performance } from '@/domain/performance'
import type { ArtistSortMode } from '@/features/preferences/model'

export interface ArtistSummaryItem {
  name: string
  times: number
}

export type FacetSummaryItem = ArtistSummaryItem

export function computeArtistSummary(
  performances: readonly Pick<Performance, 'facets'>[],
  sortMode: ArtistSortMode,
): ArtistSummaryItem[] {
  let nextOrder = 0
  const counts = new Map<string, { times: number; order: number }>()

  for (const performance of performances) {
    for (const rawName of performance.facets.artist ?? []) {
      const name = rawName.trim()
      const existing = counts.get(name)
      if (existing) {
        existing.times += 1
      } else {
        counts.set(name, { times: 1, order: nextOrder })
        nextOrder += 1
      }
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (sortMode === 'times' && left[1].times !== right[1].times) {
        return right[1].times - left[1].times
      }
      return left[1].order - right[1].order
    })
    .map(([name, { times }]) => ({ name, times }))
}

export function computePlaySummary(
  performances: readonly Pick<Performance, 'facets'>[],
  sortMode: ArtistSortMode,
): FacetSummaryItem[] {
  let nextOrder = 0
  const counts = new Map<string, { times: number; order: number }>()

  for (const performance of performances) {
    for (const rawName of performance.facets.play ?? []) {
      const name = rawName.trim()
      if (!name) continue
      const existing = counts.get(name)
      if (existing) {
        existing.times += 1
      } else {
        counts.set(name, { times: 1, order: nextOrder })
        nextOrder += 1
      }
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (sortMode === 'times' && left[1].times !== right[1].times) {
        return right[1].times - left[1].times
      }
      return left[1].order - right[1].order
    })
    .map(([name, { times }]) => ({ name, times }))
}

export function artistIntensityLevel(times: number): 0 | 1 | 2 | 3 | 4 {
  if (times >= 15) return 4
  if (times >= 10) return 3
  if (times >= 5) return 2
  if (times >= 3) return 1
  return 0
}
