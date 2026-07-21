import { describe, expect, it } from 'vitest'

import { PerformanceStatus, type Performance } from '@/domain/performance'
import { buildPlayDetailSummary } from '@/features/performances/artist-detail'

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
    facets: { play: ['剧目 A'] },
    mediaAssets: [],
    createdAtMs: 1,
    updatedAtMs: 1,
    ...overrides,
  }
}

describe('iOS-compatible play detail summary', () => {
  it('matches an exact normalized play and aggregates artists, cities and expenses', () => {
    const summary = buildPlayDetailSummary('剧目 A', [
      performance('1', { facets: { play: ['剧目 A'], artist: ['甲乐队', '乙艺人'] } }),
      performance('3', { city: '杭州', facets: { play: [' 剧目 A '], artist: ['甲乐队'] } }),
      performance('2', { facets: { play: ['剧目 A 特别版'], artist: ['丙组合'] } }),
    ])

    expect(summary.performances.map(({ id }) => id)).toEqual(['3', '1'])
    expect(summary.artists).toEqual([
      { name: '甲乐队', times: 2 },
      { name: '乙艺人', times: 1 },
    ])
    expect(summary.cities).toEqual([
      { name: '杭州', times: 1 },
      { name: '上海', times: 1 },
    ])
    expect(summary.expenses).toEqual([
      { currency: 'CNY', ticketPrice: '200', paidPrice: '160', otherCost: '40', totalCost: '200' },
    ])
  })
})
