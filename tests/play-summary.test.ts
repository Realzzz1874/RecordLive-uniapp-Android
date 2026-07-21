import { describe, expect, it } from 'vitest'

import { computePlaySummary } from '@/features/performances/artist-summary'

describe('iOS-compatible play summary', () => {
  const performances = [
    { facets: { play: [' 剧目 A ', '剧目 B', '剧目 A'] } },
    { facets: { play: ['剧目 B', '剧目 C', '剧目 C'] } },
    { facets: { play: ['剧目 D', '剧目 C', ''] } },
  ]

  it('counts every normalized appearance and keeps first-seen order for ties', () => {
    expect(computePlaySummary(performances, 'times')).toEqual([
      { name: '剧目 C', times: 3 },
      { name: '剧目 A', times: 2 },
      { name: '剧目 B', times: 2 },
      { name: '剧目 D', times: 1 },
    ])
    expect(computePlaySummary(performances, 'date')).toEqual([
      { name: '剧目 A', times: 2 },
      { name: '剧目 B', times: 2 },
      { name: '剧目 C', times: 3 },
      { name: '剧目 D', times: 1 },
    ])
  })
})
