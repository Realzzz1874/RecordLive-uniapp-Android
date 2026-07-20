import { describe, expect, it } from 'vitest'

import { PerformanceStatus, type Performance } from '@/domain/performance'
import {
  buildMonthCalendar,
  formatAggregatedAmount,
  ImprintQueryService,
  imprintYears,
  localDateKey,
  summarizeImprintYear,
} from '@/features/imprints/model'
import { InMemoryPerformanceRepository } from '@/platform/repositories/in-memory-performance-repository'

function performance(id: string, startedAtMs: number, overrides: Partial<Performance> = {}): Performance {
  return {
    id,
    name: `演出 ${id}`,
    startedAtMs,
    city: '上海',
    venue: '音乐厅',
    remark: '',
    ticketPrice: { amount: '100', currency: 'CNY' },
    paidPrice: { amount: '80', currency: 'CNY' },
    otherCost: { amount: '20', currency: 'CNY' },
    seat: '',
    rating: 4,
    status: PerformanceStatus.Normal,
    categoryId: null,
    coordinate: null,
    tagIds: [],
    facets: { artist: ['甲乐队'] },
    mediaAssets: [],
    createdAtMs: 1,
    updatedAtMs: 1,
    ...overrides,
  }
}

describe('Milestone 4 imprint calendar', () => {
  it('always builds a Monday-first 42-cell calendar with spillover days', () => {
    const selected = new Date(2026, 2, 15, 12).getTime()
    const cells = buildMonthCalendar(2026, 2, [], selected, selected)

    expect(cells).toHaveLength(42)
    expect(localDateKey(cells[0].dateMs)).toBe('2026-02-23')
    expect(localDateKey(cells[41].dateMs)).toBe('2026-04-05')
    expect(cells[0].inCurrentMonth).toBe(false)
    expect(cells.find(({ isSelected }) => isSelected)?.day).toBe(15)
    expect(cells.find(({ isToday }) => isToday)?.day).toBe(15)
  })

  it('groups same-day performances, sorts by time and exposes a poster marker', () => {
    const morning = performance('morning', new Date(2026, 6, 8, 10).getTime())
    const evening = performance('evening', new Date(2026, 6, 8, 20).getTime(), {
      mediaAssets: [{
        id: 'poster',
        kind: 'poster_thumb',
        relativePath: 'media/poster.jpg',
        mimeType: 'image/jpeg',
        byteSize: 1,
        sha256: 'a'.repeat(64),
        width: 10,
        height: 10,
        createdAtMs: 1,
      }],
    })
    const cells = buildMonthCalendar(2026, 6, [evening, morning], morning.startedAtMs)
    const selected = cells.find(({ isSelected }) => isSelected)

    expect(selected).toMatchObject({ count: 2, hasPoster: true })
    expect(selected?.performances.map(({ id }) => id)).toEqual(['morning', 'evening'])
  })
})

describe('Milestone 4 annual insights', () => {
  it('aggregates lifecycle, distinct days, rating, cities and lineup rankings', () => {
    const referenceTimeMs = new Date(2026, 6, 20).getTime()
    const items = [
      performance('one', new Date(2026, 0, 2, 19).getTime(), {
        city: '上海',
        facets: { artist: ['甲乐队', '乙艺人'], play: ['剧目 A'] },
        rating: 5,
      }),
      performance('two', new Date(2026, 0, 2, 21).getTime(), {
        city: '杭州',
        facets: { artist: ['甲乐队'], play: ['剧目 B'] },
        rating: 3,
      }),
      performance('three', new Date(2026, 11, 1, 20).getTime(), {
        city: '上海',
        status: PerformanceStatus.Cancelled,
        facets: { artist: ['甲乐队'] },
        rating: 0,
      }),
      performance('other-year', new Date(2025, 1, 1).getTime()),
    ]

    const summary = summarizeImprintYear(2026, items, referenceTimeMs)
    expect(summary).toMatchObject({
      total: 3,
      uniqueDays: 2,
      cityCount: 2,
      artistCount: 2,
      playCount: 2,
      averageRating: 4,
      lifecycleCounts: { attended: 2, upcoming: 0, cancelled: 1, 'pending-sale': 0, missed: 0 },
    })
    expect(summary.cityRanking).toEqual([{ name: '上海', count: 2 }, { name: '杭州', count: 1 }])
    expect(summary.artistRanking[0]).toEqual({ name: '甲乐队', count: 3 })
  })

  it('keeps currencies separate and sums decimal amounts exactly', () => {
    const items = [
      performance('cny-1', new Date(2026, 1, 1).getTime(), {
        ticketPrice: { amount: '0.1', currency: 'CNY' },
        paidPrice: { amount: '0.1', currency: 'CNY' },
        otherCost: { amount: '0.2', currency: 'CNY' },
      }),
      performance('cny-2', new Date(2026, 1, 2).getTime(), {
        ticketPrice: { amount: '0.2', currency: 'CNY' },
        paidPrice: { amount: '0.2', currency: 'CNY' },
        otherCost: { amount: '0', currency: 'CNY' },
      }),
      performance('usd', new Date(2026, 1, 3).getTime(), {
        ticketPrice: { amount: '50', currency: 'USD' },
        paidPrice: { amount: '40', currency: 'USD' },
        otherCost: { amount: '5', currency: 'USD' },
      }),
    ]

    expect(summarizeImprintYear(2026, items).expenses).toEqual([
      { currency: 'CNY', ticketPrice: '0.3', paidPrice: '0.3', otherCost: '0.2', totalCost: '0.5' },
      { currency: 'USD', ticketPrice: '50', paidPrice: '40', otherCost: '5', totalCost: '45' },
    ])
    expect(formatAggregatedAmount('0.5')).toBe('0.50')
    expect(formatAggregatedAmount('45')).toBe('45.00')
  })

  it('loads every repository page and returns stable year options', async () => {
    const items = Array.from({ length: 251 }, (_, index) =>
      performance(String(index), new Date(index === 250 ? 2025 : 2026, 0, 1, index % 24).getTime()))
    const service = new ImprintQueryService(new InMemoryPerformanceRepository({ initialItems: items }))
    const snapshot = await service.loadSnapshot(new Date(2026, 6, 1).getTime())

    expect(snapshot.performances).toHaveLength(251)
    expect(snapshot.years).toEqual([2026, 2025])
    expect(imprintYears([], 2027)).toEqual([2027])
  })
})
