import { describe, expect, it } from 'vitest'

import {
  artistIntensityLevel,
  computeArtistSummary,
} from '@/features/performances/artist-summary'

describe('iOS-compatible artist summary', () => {
  const performances = [
    { facets: { artist: [' 甲乐队 ', '乙艺人', '甲乐队'] } },
    { facets: { artist: ['乙艺人', '丙组合'] } },
    { facets: { artist: ['丁歌手', '丙组合', '丙组合'] } },
  ]

  it('counts every appearance and keeps first-seen order as the tie breaker', () => {
    expect(computeArtistSummary(performances, 'times')).toEqual([
      { name: '丙组合', times: 3 },
      { name: '甲乐队', times: 2 },
      { name: '乙艺人', times: 2 },
      { name: '丁歌手', times: 1 },
    ])

    expect(computeArtistSummary(performances, 'date')).toEqual([
      { name: '甲乐队', times: 2 },
      { name: '乙艺人', times: 2 },
      { name: '丙组合', times: 3 },
      { name: '丁歌手', times: 1 },
    ])
  })

  it('matches the five iOS intensity ranges', () => {
    expect([1, 2, 3, 4, 5, 9, 10, 14, 15].map(artistIntensityLevel)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4,
    ])
  })
})
