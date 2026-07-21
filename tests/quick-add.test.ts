import { describe, expect, it } from 'vitest'

import { PerformanceStatus, type Performance } from '@/domain/performance'
import {
  copyPerformanceFields,
  createEmptyPerformanceDraft,
  performancePosterAsSelectedImage,
} from '@/features/performances/editor'
import {
  DEFAULT_QUICK_ADD_PREFERENCES,
  normalizeQuickAddPreferences,
} from '@/features/preferences/quick-add'

const source: Performance = {
  id: 'source',
  name: '原演出',
  startedAtMs: 1_800_000_000_000,
  city: '上海',
  venue: '上海大剧院',
  remark: '原备注',
  ticketPrice: { amount: '680', currency: 'USD' },
  paidPrice: { amount: '600', currency: 'CNY' },
  otherCost: { amount: '88', currency: 'CNY' },
  seat: 'A1',
  rating: 5,
  status: PerformanceStatus.Cancelled,
  categoryId: 'musical',
  coordinate: { latitude: 31, longitude: 121 },
  tagIds: ['首演'],
  facets: {
    artist: ['甲演员'],
    play: ['甲剧目'],
    guest: ['乙嘉宾'],
    channel: ['大麦'],
    friend: ['小林'],
    company: ['甲厂牌'],
  },
  mediaAssets: [
    {
      id: 'thumb',
      kind: 'poster_thumb',
      relativePath: '_doc/recordlive/media/thumb.jpg',
      mimeType: 'image/jpeg',
      byteSize: 100,
      sha256: 'a'.repeat(64),
      width: 360,
      height: 480,
      createdAtMs: 1,
    },
    {
      id: 'poster',
      kind: 'poster',
      relativePath: '_doc/recordlive/media/poster.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1000,
      sha256: 'b'.repeat(64),
      width: 1080,
      height: 1440,
      createdAtMs: 1,
    },
    {
      id: 'ticket',
      kind: 'ticket_original',
      relativePath: '_doc/recordlive/media/ticket.jpg',
      mimeType: 'image/jpeg',
      byteSize: 800,
      sha256: 'c'.repeat(64),
      width: null,
      height: null,
      createdAtMs: 1,
    },
  ],
  createdAtMs: 1,
  updatedAtMs: 1,
}

describe('quick add preferences', () => {
  it('defaults copy-existing to enabled and preserves a valid user choice', () => {
    expect(normalizeQuickAddPreferences(null)).toEqual(DEFAULT_QUICK_ADD_PREFERENCES)
    expect(normalizeQuickAddPreferences({ copyExisting: false })).toEqual({
      copyExisting: false,
      parseLink: true,
      chineseMusicalSchedule: true,
      koreanMusicalSchedule: true,
      chineseMusicalCity: '上海',
    })
    expect(normalizeQuickAddPreferences({
      copyExisting: 'yes',
      parseLink: false,
      chineseMusicalSchedule: false,
      koreanMusicalSchedule: false,
      chineseMusicalCity: ' 北京 ',
    })).toEqual({
      copyExisting: true,
      parseLink: false,
      chineseMusicalSchedule: false,
      koreanMusicalSchedule: false,
      chineseMusicalCity: '北京',
    })
  })
})

describe('copy existing performance', () => {
  it('copies only selected fields and preserves unchecked destination state', () => {
    const destination = createEmptyPerformanceDraft(1_900_000_000_000)
    destination.name = '当前名称'
    destination.city = '北京'
    destination.venue = '当前场地'
    destination.status = PerformanceStatus.PendingSale
    destination.otherCost = { amount: '20', currency: 'CNY' }
    destination.facets = { guest: ['当前嘉宾'] }

    const copied = copyPerformanceFields(destination, source, [
      'name', 'city', 'ticketPrice', 'artist', 'category', 'tags',
    ])

    expect(copied).toMatchObject({
      name: '原演出',
      startedAtMs: 1_900_000_000_000,
      city: '上海',
      venue: '当前场地',
      status: PerformanceStatus.PendingSale,
      categoryId: 'musical',
      tagIds: ['首演'],
      ticketPrice: { amount: '680', currency: 'CNY' },
      otherCost: { amount: '20', currency: 'CNY' },
      facets: { artist: ['甲演员'], guest: ['当前嘉宾'] },
      mediaAssets: [],
    })
    expect(copied.id).toBeUndefined()
    expect(copied.coordinate).toBeNull()
  })

  it('converts the original poster into a new media preparation input and excludes the ticket', () => {
    expect(performancePosterAsSelectedImage(source)).toEqual({
      sourcePath: '_doc/recordlive/media/poster.jpg',
      previewPath: '_doc/recordlive/media/poster.jpg',
      byteSize: 1000,
      mimeType: 'image/jpeg',
    })
  })
})
