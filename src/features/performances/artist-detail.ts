import type { Performance } from '@/domain/performance'
import {
  summarizeExpenses,
  type ImprintExpenseSummary,
} from '@/features/imprints/model'

export interface ArtistDetailRankEntry {
  name: string
  times: number
}

export interface ArtistDetailSummary {
  performances: Performance[]
  expenses: ImprintExpenseSummary[]
  plays: ArtistDetailRankEntry[]
  cities: ArtistDetailRankEntry[]
}

export interface PlayDetailSummary {
  performances: Performance[]
  expenses: ImprintExpenseSummary[]
  artists: ArtistDetailRankEntry[]
  cities: ArtistDetailRankEntry[]
}

export function buildArtistDetailSummary(
  artistName: string,
  performances: readonly Performance[],
): ArtistDetailSummary {
  const normalizedArtistName = artistName.trim()
  const artistPerformances = performances
    .filter(({ facets }) => (facets.artist ?? []).some(
      (name) => name.trim() === normalizedArtistName,
    ))
    .sort((left, right) => right.startedAtMs - left.startedAtMs || left.id.localeCompare(right.id))

  return {
    performances: artistPerformances,
    expenses: summarizeExpenses(artistPerformances),
    plays: rankAppearances(artistPerformances.flatMap(({ facets }) => facets.play ?? [])),
    cities: rankCities(artistPerformances.map(({ city }) => city)),
  }
}

export function buildPlayDetailSummary(
  playName: string,
  performances: readonly Performance[],
): PlayDetailSummary {
  const normalizedPlayName = playName.trim()
  const playPerformances = performances
    .filter(({ facets }) => (facets.play ?? []).some(
      (name) => name.trim() === normalizedPlayName,
    ))
    .sort((left, right) => right.startedAtMs - left.startedAtMs || left.id.localeCompare(right.id))

  return {
    performances: playPerformances,
    expenses: summarizeExpenses(playPerformances),
    artists: rankAppearances(playPerformances.flatMap(({ facets }) => facets.artist ?? [])),
    cities: rankCities(playPerformances.map(({ city }) => city)),
  }
}

function rankAppearances(values: readonly string[]): ArtistDetailRankEntry[] {
  let nextOrder = 0
  const counts = new Map<string, { times: number; order: number }>()

  for (const rawValue of values) {
    const name = rawValue.trim()
    if (!name) continue
    const existing = counts.get(name)
    if (existing) {
      existing.times += 1
    } else {
      counts.set(name, { times: 1, order: nextOrder })
      nextOrder += 1
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1].times - left[1].times || left[1].order - right[1].order)
    .map(([name, { times }]) => ({ name, times }))
}

function rankCities(values: readonly string[]): ArtistDetailRankEntry[] {
  const counts = new Map<string, number>()
  for (const rawValue of values) {
    const name = rawValue.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, times]) => ({ name, times }))
    .sort((left, right) => right.times - left.times || left.name.localeCompare(right.name, 'zh-CN'))
}
