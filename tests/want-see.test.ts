import { describe, expect, it } from 'vitest'

import { PerformanceStatus, type Performance } from '@/domain/performance'
import {
  createWantSeeQuery,
  DEFAULT_WANT_SEE_PREFERENCES,
  normalizeWantSeePreferences,
} from '@/features/want-see/model'
import { InMemoryPerformanceRepository } from '@/platform/repositories/in-memory-performance-repository'

describe('want-see preferences', () => {
  it('uses independent defaults and accepts only the three want-see display modes', () => {
    expect(normalizeWantSeePreferences(null)).toEqual(DEFAULT_WANT_SEE_PREFERENCES)
    expect(normalizeWantSeePreferences({
      displayMode: 'timeline',
      includePendingSale: false,
    })).toEqual({
      displayMode: 'timeline',
      includePendingSale: false,
    })
    expect(normalizeWantSeePreferences({
      displayMode: 'poster',
      includePendingSale: 'yes',
    })).toEqual(DEFAULT_WANT_SEE_PREFERENCES)
  })
})

describe('want-see query', () => {
  it('returns only future normal and future pending-sale performances', async () => {
    const now = 1_800_000_000_000
    const repository = new InMemoryPerformanceRepository({
      initialItems: [
        performance('future-normal', now + 2, PerformanceStatus.Normal),
        performance('future-pending', now + 3, PerformanceStatus.PendingSale),
        performance('past-pending', now - 1, PerformanceStatus.PendingSale),
        performance('future-cancelled', now + 4, PerformanceStatus.Cancelled),
      ],
    })

    const withPendingSale = await repository.list(createWantSeeQuery(true, now))
    expect(withPendingSale.items.map(({ id }) => id)).toEqual([
      'future-normal',
      'future-pending',
    ])

    const withoutPendingSale = await repository.list(createWantSeeQuery(false, now))
    expect(withoutPendingSale.items.map(({ id }) => id)).toEqual(['future-normal'])
  })
})

function performance(
  id: string,
  startedAtMs: number,
  status: PerformanceStatus,
): Performance {
  return {
    id,
    name: id,
    startedAtMs,
    city: '',
    venue: '',
    remark: '',
    ticketPrice: { amount: '', currency: 'CNY' },
    paidPrice: { amount: '', currency: 'CNY' },
    otherCost: { amount: '', currency: 'CNY' },
    seat: '',
    rating: 0,
    status,
    categoryId: null,
    coordinate: null,
    tagIds: [],
    facets: {},
    mediaAssets: [],
    createdAtMs: startedAtMs,
    updatedAtMs: startedAtMs,
  }
}
