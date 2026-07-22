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
import {
  MaoyanParser,
  normalizeMaoyanUrl,
  parseMaoyanHtml,
} from '@/features/performances/parse-platform/maoyan'
import {
  defaultParsePlatformHttpClient,
  platformAssetUrl,
} from '@/features/performances/parse-platform/networking'
import { createParsePlatformRouter } from '@/features/performances/parse-platform/registry'
import { ParsePlatformRouter } from '@/features/performances/parse-platform/router'
import { ParsePlatformError, type ParsePlatformResult } from '@/features/performances/parse-platform/types'
import { parseHttpUrl, type ParsePlatformUrl } from '@/features/performances/parse-platform/url'

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

const maoyanFixture = `
  <html><body>
    <script>
      __NEXT_DATA__ = {"props":{"pageProps":{"detail":{
        "name":"【猫眼官方优惠】音乐剧《寻找李二狗》",
        "showTimeRange":"2025.4.19 19:30 周六",
        "cityName":"济南",
        "shopName":"山东省会大剧院",
        "posterUrl":"//p0.meituan.net/moviesh/poster.jpg",
        "notice":"包含 } 和 \\"引号\\" 的内容"
      }}}};
      window.__NEXT_LOADED_CHUNKS__ = []
    </script>
  </body></html>
`

describe('parse platform routing', () => {
  it('accepts only exact Damai hosts and paths and normalizes mobile links', () => {
    const parser = new DamaiParser({ getText: vi.fn() })
    expect(parser.canParse(url('https://detail.damai.cn/item.htm?id=743069303901'))).toBe(true)
    expect(parser.canParse(url('https://m.damai.cn/shows/item.html?itemId=743069303901'))).toBe(true)
    expect(parser.canParse(url('https://m.damai.cn/damai/detail/item.html?itemId=743069303901'))).toBe(true)
    expect(parser.canParse(url('http://detail.damai.cn/item.htm?id=743069303901'))).toBe(false)
    expect(parser.canParse(url('https://detail.damai.cn.evil.test/item.htm?id=743069303901'))).toBe(false)
    expect(parser.canParse(url('https://detail.damai.cn/other?id=743069303901'))).toBe(false)
    expect(parser.canParse(url('https://detail.damai.cn/item.htm?id=abc'))).toBe(false)

    expect(normalizeDamaiUrl(
      url('https://m.damai.cn/shows/item.html?itemId=743069303901&from=share'),
    ).href).toBe('https://detail.damai.cn/item.htm?id=743069303901')
  })

  it('keeps the router independent from platform-specific parsing', async () => {
    const getText = vi.fn().mockResolvedValue(fixture)
    const router = new ParsePlatformRouter([new DamaiParser({ getText })])
    const parsed = await router.parse(
      url('https://m.damai.cn/damai/detail/item.html?itemId=743069303901'),
    )

    expect(getText).toHaveBeenCalledWith(
      url('https://detail.damai.cn/item.htm?id=743069303901'),
    )
    expect(parsed.platformName).toBe('大麦')
    expect(() => router.parserFor(url('https://example.com/item.htm?id=1')))
      .toThrowError(ParsePlatformError)
  })

  it('parses a Damai result when browser URL APIs are unavailable', async () => {
    vi.stubGlobal('URL', undefined)
    try {
      const parsedUrl = extractFirstHttpUrl(
        '复制 https://m.damai.cn/shows/item.html?itemId=1061626307208 即可查看',
      )
      expect(parsedUrl?.href).toBe('https://m.damai.cn/shows/item.html?itemId=1061626307208')
      if (!parsedUrl) throw new Error('Expected the Damai URL to be parsed')

      const getText = vi.fn().mockResolvedValue(fixture)
      const router = new ParsePlatformRouter([new DamaiParser({ getText })])
      const result = await router.parse(parsedUrl)

      expect(getText).toHaveBeenCalledWith(
        url('https://detail.damai.cn/item.htm?id=1061626307208'),
      )
      expect(result.name).toBe('【上海】音乐剧《时光代理人》')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('registers Maoyan without adding platform branches to the router', () => {
    const router = createParsePlatformRouter()
    expect(router.parserFor(url('https://www.gewara.com/detail/387805')).platformName)
      .toBe('猫眼')
    expect(router.parserFor(url('https://show.maoyan.com/qqw#/detail/387805')).platformName)
      .toBe('猫眼')
  })
})

describe('parse platform networking', () => {
  it('uses a desktop user agent for App page requests to avoid Damai mobile redirects', async () => {
    interface RequestOptions {
      url: string
      header: Record<string, string>
      success: (result: { statusCode: number; data: string }) => void
    }

    const request = vi.fn((options: RequestOptions) => {
      options.success({ statusCode: 200, data: fixture })
    })
    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'app' }),
      request,
    })

    try {
      await expect(defaultParsePlatformHttpClient.getText(
        url('https://detail.damai.cn/item.htm?id=1061626307208'),
      )).resolves.toBe(fixture)
      await expect(defaultParsePlatformHttpClient.getText(
        url('https://www.gewara.com/detail/387805'),
      )).resolves.toBe(fixture)

      const damaiOptions = request.mock.calls[0]?.[0]
      expect(damaiOptions?.url).toBe('https://detail.damai.cn/item.htm?id=1061626307208')
      expect(damaiOptions?.header['User-Agent']).toContain('Linux x86_64')
      expect(damaiOptions?.header['User-Agent']).not.toContain('Mobile')
      expect(request.mock.calls[1]?.[0].url).toBe('https://www.gewara.com/detail/387805')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps Maoyan H5 proxying separate from the Android App request path', async () => {
    interface RequestOptions {
      url: string
      success: (result: { statusCode: number; data: string }) => void
    }

    const request = vi.fn((options: RequestOptions) => {
      options.success({ statusCode: 200, data: maoyanFixture })
    })
    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'web' }),
      request,
    })

    try {
      await defaultParsePlatformHttpClient.getText(url('https://www.gewara.com/detail/387805'))
      expect(request.mock.calls[0]?.[0].url).toBe('/maoyan-proxy/detail/387805')
      expect(platformAssetUrl('https://p0.meituan.net/moviesh/poster.jpg'))
        .toBe('/maoyan-image-proxy/moviesh/poster.jpg')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

function url(value: string): ParsePlatformUrl {
  const parsed = parseHttpUrl(value)
  if (!parsed) throw new Error(`Invalid test URL: ${value}`)
  return parsed
}

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

describe('Maoyan parser', () => {
  it('accepts only exact iOS-supported hosts and routes and normalizes share links', () => {
    const parser = new MaoyanParser({ getText: vi.fn() })
    expect(parser.canParse(url('https://www.gewara.com/detail/387805'))).toBe(true)
    expect(parser.canParse(url('https://show.maoyan.com/qqw#/detail/387805'))).toBe(true)
    expect(parser.canParse(url('http://www.gewara.com/detail/387805'))).toBe(false)
    expect(parser.canParse(url('https://gewara.com/detail/387805'))).toBe(false)
    expect(parser.canParse(url('https://www.gewara.com/detail/not-a-number'))).toBe(false)
    expect(parser.canParse(url('https://show.maoyan.com/qqw#/other/387805'))).toBe(false)
    expect(parser.canParse(url('https://show.maoyan.com.evil.test/qqw#/detail/387805'))).toBe(false)

    expect(normalizeMaoyanUrl(
      url('https://show.maoyan.com/qqw#/detail/387805'),
    ).href).toBe('https://www.gewara.com/detail/387805')
  })

  it('requests the normalized Gewara page and parses the current iOS data contract', async () => {
    const getText = vi.fn().mockResolvedValue(maoyanFixture)
    const parsed = await new MaoyanParser({ getText }).parse(
      url('https://show.maoyan.com/qqw#/detail/387805'),
    )

    expect(getText).toHaveBeenCalledWith(url('https://www.gewara.com/detail/387805'))
    expect(parsed).toEqual({
      platformName: '猫眼',
      name: '【猫眼官方优惠】音乐剧《寻找李二狗》',
      play: '寻找李二狗',
      startedAtMs: new Date(2025, 3, 19, 19, 30).getTime(),
      city: '济南',
      venue: '山东省会大剧院',
      artistNames: [],
      coverUrl: 'https://p0.meituan.net/moviesh/poster.jpg',
    })
  })

  it('keeps a missing date empty and rejects missing or malformed embedded data', () => {
    const withoutDate = maoyanFixture.replace('2025.4.19 19:30 周六', '')
    expect(parseMaoyanHtml(withoutDate).startedAtMs).toBeNull()
    expect(() => parseMaoyanHtml('<html></html>')).toThrowError(ParsePlatformError)
    expect(() => parseMaoyanHtml('<script>__NEXT_DATA__ = {bad}</script>'))
      .toThrowError(ParsePlatformError)
  })

  it('extracts a Maoyan hash link from shared text without browser URL APIs', () => {
    vi.stubGlobal('URL', undefined)
    try {
      expect(extractFirstHttpUrl(
        '猫眼演出 https://show.maoyan.com/qqw#/detail/387805 点击查看',
      )?.href).toBe('https://show.maoyan.com/qqw#/detail/387805')
    } finally {
      vi.unstubAllGlobals()
    }
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
