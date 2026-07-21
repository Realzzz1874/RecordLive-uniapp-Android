import { describe, expect, it, vi } from 'vitest'

import { createEmptyPerformanceDraft } from '@/features/performances/editor'
import {
  applyParseLinkResult,
  availableParseLinkFields,
  extractFirstHttpUrl,
} from '@/features/performances/parse-link'
import {
  DamaiParser,
  normalizeDamaiUrl,
  parseDamaiHtml,
} from '@/features/performances/parse-platform/damai'
import { ParsePlatformRouter } from '@/features/performances/parse-platform/router'
import { ParsePlatformError, type ParsePlatformResult } from '@/features/performances/parse-platform/types'

const fixture = `
  <html><body>
    <div id="staticDataDefault" style="display: none">{
      &quot;venue&quot;: {
        &quot;venueName&quot;: &quot;时光剧场&quot;,
        &quot;venueCityName&quot;: &quot;上海市&quot;
      },
      &quot;itemBase&quot;: {
        &quot;showTime&quot;: &quot;2026.07.24-08.31&quot;,
        &quot;itemName&quot;: &quot;【上海】音乐剧《时光代理人》&quot;,
        &quot;itemPic&quot;: &quot;//img.alicdn.com/poster.jpg&quot;
      }
    }</div>
  </body></html>
`

describe('parse platform routing', () => {
  it('accepts only exact Damai hosts and paths and normalizes mobile links', () => {
    const parser = new DamaiParser({ getText: vi.fn() })
    expect(parser.canParse(new URL('https://detail.damai.cn/item.htm?id=743069303901'))).toBe(true)
    expect(parser.canParse(new URL('https://m.damai.cn/shows/item.html?itemId=743069303901'))).toBe(true)
    expect(parser.canParse(new URL('https://m.damai.cn/damai/detail/item.html?itemId=743069303901'))).toBe(true)
    expect(parser.canParse(new URL('http://detail.damai.cn/item.htm?id=743069303901'))).toBe(false)
    expect(parser.canParse(new URL('https://detail.damai.cn.evil.test/item.htm?id=743069303901'))).toBe(false)
    expect(parser.canParse(new URL('https://detail.damai.cn/other?id=743069303901'))).toBe(false)
    expect(parser.canParse(new URL('https://detail.damai.cn/item.htm?id=abc'))).toBe(false)

    expect(normalizeDamaiUrl(
      new URL('https://m.damai.cn/shows/item.html?itemId=743069303901&from=share'),
    ).href).toBe('https://detail.damai.cn/item.htm?id=743069303901')
  })

  it('keeps the router independent from platform-specific parsing', async () => {
    const getText = vi.fn().mockResolvedValue(fixture)
    const router = new ParsePlatformRouter([new DamaiParser({ getText })])
    const parsed = await router.parse(
      new URL('https://m.damai.cn/damai/detail/item.html?itemId=743069303901'),
    )

    expect(getText).toHaveBeenCalledWith(
      new URL('https://detail.damai.cn/item.htm?id=743069303901'),
    )
    expect(parsed.platformName).toBe('大麦')
    expect(() => router.parserFor(new URL('https://example.com/item.htm?id=1')))
      .toThrowError(ParsePlatformError)
  })
})

describe('Damai parser', () => {
  it('parses the same staticDataDefault contract used by the iOS parser', () => {
    const parsed = parseDamaiHtml(fixture)
    expect(parsed).toEqual({
      platformName: '大麦',
      name: '【上海】音乐剧《时光代理人》',
      play: '时光代理人',
      startedAtMs: new Date(2026, 6, 24, 0, 0).getTime(),
      city: '上海',
      venue: '时光剧场',
      artistNames: [],
      coverUrl: 'https://img.alicdn.com/poster.jpg',
    })
  })

  it('rejects a page without embedded performance data', () => {
    expect(() => parseDamaiHtml('<html></html>')).toThrowError(ParsePlatformError)
  })
})

describe('parsed-link field application', () => {
  const parsed: ParsePlatformResult = parseDamaiHtml(fixture)

  it('extracts a link from shared text and exposes only fields that have values', () => {
    expect(extractFirstHttpUrl(
      '复制这段内容 https://detail.damai.cn/item.htm?id=743069303901 即可查看',
    )?.href).toBe('https://detail.damai.cn/item.htm?id=743069303901')
    expect(availableParseLinkFields(parsed)).toEqual([
      'poster', 'name', 'play', 'date', 'city', 'venue',
    ])
  })

  it('fills only selected fields and preserves unchecked editor state', () => {
    const destination = createEmptyPerformanceDraft(1_900_000_000_000)
    destination.name = '原来的名称'
    destination.city = '北京'
    destination.venue = '原来的场地'
    destination.coordinate = { latitude: 39.9, longitude: 116.4 }
    destination.facets = { artist: ['原阵容'], play: ['原主题'] }

    const applied = applyParseLinkResult(destination, parsed, ['name', 'date', 'city'])
    expect(applied).toMatchObject({
      name: '【上海】音乐剧《时光代理人》',
      startedAtMs: new Date(2026, 6, 24, 0, 0).getTime(),
      city: '上海',
      venue: '原来的场地',
      coordinate: null,
      facets: { artist: ['原阵容'], play: ['原主题'] },
    })
  })
})
