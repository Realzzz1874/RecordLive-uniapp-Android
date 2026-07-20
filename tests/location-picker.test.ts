import { describe, expect, it } from 'vitest'

import { PerformanceStatus, type Performance } from '@/domain/performance'
import {
  formatSelectedLocation,
  frequentLocationCities,
  groupedLocationCities,
  locationCities,
  locationVenues,
} from '@/features/performances/location'

function performance(id: string, city: string, venue: string, status = PerformanceStatus.Normal): Performance {
  return {
    id,
    name: `演出 ${id}`,
    startedAtMs: 1_800_000_000_000,
    city,
    venue,
    remark: '',
    ticketPrice: { amount: '0', currency: 'CNY' },
    paidPrice: { amount: '0', currency: 'CNY' },
    otherCost: { amount: '0', currency: 'CNY' },
    seat: '',
    rating: 0,
    status,
    categoryId: null,
    coordinate: null,
    tagIds: [],
    facets: {},
    mediaAssets: [],
    createdAtMs: 1,
    updatedAtMs: 1,
  }
}

describe('city and venue selection', () => {
  it('keeps default and other regions separate and supports pinyin search', () => {
    expect(locationCities('default').some(({ name }) => name === '上海')).toBe(true)
    expect(locationCities('other').some(({ name }) => name === '东京')).toBe(true)
    expect(locationCities('default', 'shanghai').map(({ name }) => name)).toContain('上海')
    expect(locationCities('other', '东京').map(({ name }) => name)).toEqual(['东京'])
    expect(groupedLocationCities('default', 'shanghai')).toMatchObject([
      { initial: 'S', cities: [{ name: '上海' }] },
    ])
  })

  it('ranks frequent normal-performance cities and ignores explicit non-normal states', () => {
    const items = [
      performance('1', '上海', '场地 A'),
      performance('2', '上海', '场地 B'),
      performance('3', '杭州', '场地 C'),
      performance('4', '北京', '场地 D', PerformanceStatus.Cancelled),
    ]
    expect(frequentLocationCities(items)).toEqual(['上海', '杭州'])
  })

  it('merges historical venues before the bundled city catalog without duplicates', () => {
    const venues = locationVenues('上海', [
      performance('1', '上海', '我的常用场地'),
      performance('2', '上海', '上海文化广场'),
      performance('3', '杭州', '其它场地'),
    ])
    expect(venues[0]).toBe('我的常用场地')
    expect(venues.filter((venue) => venue === '上海文化广场')).toHaveLength(1)
    expect(locationVenues('上海', [], '大剧院')).toContain('上海大剧院')
    expect(formatSelectedLocation(' 上海 ', ' 文化广场 ')).toBe('上海 · 文化广场')
  })
})
