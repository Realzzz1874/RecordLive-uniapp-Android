import { describe, expect, it } from 'vitest'

import { PerformanceStatus, type Performance } from '@/domain/performance'
import { buildArtistDetailSummary } from '@/features/performances/artist-detail'

function performance(id: string, overrides: Partial<Performance> = {}): Performance {
  return {
    id,
    name: `演出 ${id}`,
    startedAtMs: new Date(2026, 0, Number(id), 19).getTime(),
    city: '上海',
    venue: '音乐厅',
    remark: '',
    ticketPrice: { amount: '100', currency: 'CNY' },
    paidPrice: { amount: '80', currency: 'CNY' },
    otherCost: { amount: '20', currency: 'CNY' },
    seat: '',
    rating: 0,
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

describe('iOS-compatible artist detail summary', () => {
  it('selects exact artist appearances and sorts the performance list newest first', () => {
    const summary = buildArtistDetailSummary('甲乐队', [
      performance('1'),
      performance('3', { facets: { artist: [' 甲乐队 ', '乙艺人'] } }),
      performance('2', { facets: { artist: ['甲乐队特别版'] } }),
    ])

    expect(summary.performances.map(({ id }) => id)).toEqual(['3', '1'])
  })

  it('aggregates plays, cities and expenses from only the selected artist records', () => {
    const summary = buildArtistDetailSummary('甲乐队', [
      performance('1', {
        city: '上海',
        facets: { artist: ['甲乐队'], play: ['剧目 A', '剧目 B'] },
      }),
      performance('2', {
        city: '杭州',
        paidPrice: { amount: '120.5', currency: 'CNY' },
        facets: { artist: ['乙艺人'], play: ['剧目 A'] },
      }),
      performance('3', {
        city: '上海',
        ticketPrice: { amount: '50', currency: 'USD' },
        paidPrice: { amount: '45', currency: 'USD' },
        otherCost: { amount: '0', currency: 'USD' },
        facets: { artist: ['甲乐队'], play: ['剧目 A', '剧目 A'] },
      }),
    ])

    expect(summary.plays).toEqual([
      { name: '剧目 A', times: 3 },
      { name: '剧目 B', times: 1 },
    ])
    expect(summary.cities).toEqual([{ name: '上海', times: 2 }])
    expect(summary.expenses).toEqual([
      { currency: 'CNY', ticketPrice: '100', paidPrice: '80', otherCost: '20', totalCost: '100' },
      { currency: 'USD', ticketPrice: '50', paidPrice: '45', otherCost: '0', totalCost: '45' },
    ])
  })

  it('filters the complete artist summary by the selected homepage lifecycle values', () => {
    const referenceTimeMs = new Date(2026, 0, 2, 23).getTime()
    const summary = buildArtistDetailSummary(
      '甲乐队',
      [
        performance('1'),
        performance('2', { status: PerformanceStatus.Cancelled }),
        performance('3'),
      ],
      ['cancelled'],
      referenceTimeMs,
    )

    expect(summary.performances.map(({ id }) => id)).toEqual(['2'])
    expect(summary.cities).toEqual([{ name: '上海', times: 1 }])
    expect(summary.expenses).toHaveLength(1)
  })
})
