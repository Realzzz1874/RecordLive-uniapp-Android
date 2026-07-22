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
  ShowstartParser,
  normalizeShowstartUrl,
  parseShowstartHtml,
} from '@/features/performances/parse-platform/showstart'
import {
  ShcstheatreParser,
  normalizeShcstheatreUrl,
  parseShcstheatreHtml,
} from '@/features/performances/parse-platform/shcstheatre'
import {
  normalizePolyUrl,
  parsePolyResponse,
  PolyParser,
} from '@/features/performances/parse-platform/poly'
import {
  defaultParsePlatformHttpClient,
  defaultParsePlatformJsonClient,
  platformAssetUrl,
} from '@/features/performances/parse-platform/networking'
import {
  createParsePlatformRouter,
  SUPPORTED_PARSE_PLATFORM_NAMES,
} from '@/features/performances/parse-platform/registry'
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

const showstartFixture = `
  <html><body>
    <script>
      window.__NUXT__=(function(a){return {data:[{detail:{
        title:"北京丨音乐剧《时光代理人》特别场",
        poster:"https:\\u002F\\u002Fs2.showstart.com\\u002Fimg\\u002Fposter.jpg",
        showTime:"06月14日 19:30-06月14日 21:00",
        performers:[
          {id:1,name:"演员甲",avatar:"one"},
          {id:2,name:"演员乙",avatar:"two"},
          {id:3,name:"演员甲",avatar:"three"}
        ],
        site:{id:193127,name:"Blue Note Beijing",cityName:"北京",address:"前门东大街"},
        tickets:[{startTime:"2026-05-28 17:01:00",endTime:"2026-06-14 18:00:00"}],
        content:"包含 }、{ 和 \\"引号\\" 的介绍"
      }}]}}(0));
    </script>
  </body></html>
`

const shcstheatreFixture = `
  <html><body>
    <script>const selector = "#SCS_WEB_BRIEFNAME";</script>
    <script>
      const response = {"data":{"tblprogram":[{
        "SCS_WEB_BRIEFNAME": "音乐剧《粉丝来信》中文版",
        "VC_VENUE_IDNAME": "主剧场",
        "I_GROUND_ID_NAME": "上海文化广场",
        "SCS_MOBILE_YMXQ_PIC": "/upload/program/cover.jpg;/upload/program/second.jpg"
      }]}};
    </script>
  </body></html>
`

const polyFixture = {
  code: '200',
  success: true,
  data: {
    productName: '圣彼得堡国立模范芭蕾舞团舞剧《天鹅湖》',
    img: 'https://cdn.polyt.cn/jpg/2026-02-09/poster.jpg',
    cityName: '长沙市',
    showPlaceName: '长沙梅溪湖国际文化艺术中心大剧院',
    showStartToEndTime: '2026.04.01 星期三',
  },
}

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

  it('registers every parser without adding platform branches to the router', () => {
    const router = createParsePlatformRouter()
    expect(SUPPORTED_PARSE_PLATFORM_NAMES)
      .toEqual([
        '大麦', '猫眼', '秀动', '上海文化广场', '保利票务', '票务通', 'cityline',
        '国家大剧院', '北京音乐厅', '北京人艺票务中心', '天津中华剧院',
        '北京吉祥大戏院', '北京长安大戏院', '北京人民剧场', '北京梅兰芳大剧院',
        'Klook',
      ])
    expect(router.parserFor(url('https://www.gewara.com/detail/387805')).platformName)
      .toBe('猫眼')
    expect(router.parserFor(url('https://show.maoyan.com/qqw#/detail/387805')).platformName)
      .toBe('猫眼')
    expect(router.parserFor(url('https://www.showstart.com/event/299543')).platformName)
      .toBe('秀动')
    expect(router.parserFor(url(
      'https://wap.showstart.com/pages/activity/detail/detail?activityId=299543',
    )).platformName).toBe('秀动')
    expect(router.parserFor(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&ARTICLE_ID=41892',
    )).platformName).toBe('上海文化广场')
    expect(router.parserFor(url(
      'https://weixin.polyt.cn/thh5/#/projectdetail/9104700/null?theaterId=760',
    )).platformName).toBe('保利票务')
    expect(router.parserFor(url(
      'https://bjyyt.maitix.com/h5#/pages-order/projectDetail/index?projectId=238282035',
    )).platformName).toBe('北京音乐厅')
    expect(router.parserFor(url(
      'https://tjyrwh.maitix.com/h5#/pages-order/projectDetail/index?projectId=238832016',
    )).platformName).toBe('剧院票务')
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
      await expect(defaultParsePlatformHttpClient.getText(
        url('https://www.showstart.com/event/299543'),
      )).resolves.toBe(fixture)
      await expect(defaultParsePlatformHttpClient.getText(url(
        'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892',
      ))).resolves.toBe(fixture)

      const damaiOptions = request.mock.calls[0]?.[0]
      expect(damaiOptions?.url).toBe('https://detail.damai.cn/item.htm?id=1061626307208')
      expect(damaiOptions?.header['User-Agent']).toContain('Linux x86_64')
      expect(damaiOptions?.header['User-Agent']).not.toContain('Mobile')
      expect(request.mock.calls[1]?.[0].url).toBe('https://www.gewara.com/detail/387805')
      expect(request.mock.calls[2]?.[0].url).toBe('https://www.showstart.com/event/299543')
      expect(request.mock.calls[3]?.[0].url)
        .toBe('https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps Maoyan and Showstart H5 proxying separate from the Android App request path', async () => {
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

      await defaultParsePlatformHttpClient.getText(url('https://www.showstart.com/event/299543'))
      expect(request.mock.calls[1]?.[0].url).toBe('/showstart-proxy/event/299543')
      expect(platformAssetUrl('https://s2.showstart.com/img/poster.jpg?imageMogr2/thumbnail/640x'))
        .toBe('/showstart-image-proxy/img/poster.jpg?imageMogr2/thumbnail/640x')

      await defaultParsePlatformHttpClient.getText(url(
        'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892',
      ))
      expect(request.mock.calls[2]?.[0].url)
        .toBe('/shcstheatre-proxy/Program/ProgramDetailsWeChat.aspx?id=41892')
      expect(platformAssetUrl('https://pic.shcstheatre.com/upload/program/cover.jpg'))
        .toBe('/shcstheatre-image-proxy/upload/program/cover.jpg')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses the official Poly API directly on App and only proxies H5 development', async () => {
    interface RequestOptions {
      url: string
      header: Record<string, string>
      success: (result: { statusCode: number; data: unknown }) => void
    }

    const request = vi.fn((options: RequestOptions) => {
      options.success({ statusCode: 200, data: polyFixture })
    })
    const apiUrl = url(
      'https://weixin.polyt.cn/platform-backend/good/project/detail/9104700?source=true',
    )

    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'app' }),
      request,
    })
    await expect(defaultParsePlatformJsonClient.getJson(apiUrl, {
      Channel: 'plat_h5',
      Theater: '760',
    })).resolves.toEqual(polyFixture)
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      url: apiUrl.href,
      header: {
        Accept: 'application/json',
        Channel: 'plat_h5',
        Theater: '760',
      },
    })

    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'web' }),
      request,
    })
    await defaultParsePlatformJsonClient.getJson(apiUrl, { Channel: 'plat_h5' })
    expect(request.mock.calls[1]?.[0].url)
      .toBe('/poly-proxy/platform-backend/good/project/detail/9104700?source=true')
    expect(platformAssetUrl('https://cdn.polyt.cn/jpg/poster.jpg'))
      .toBe('/poly-image-proxy/jpg/poster.jpg')

    vi.unstubAllGlobals()
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

describe('Showstart parser', () => {
  it('accepts only the iOS-supported hosts and routes and normalizes mobile links', () => {
    const parser = new ShowstartParser({ getText: vi.fn() })
    expect(parser.canParse(url('https://www.showstart.com/event/299543'))).toBe(true)
    expect(parser.canParse(url('https://www.showstart.com/event/299543/'))).toBe(true)
    expect(parser.canParse(url(
      'https://wap.showstart.com/pages/activity/detail/detail?activityId=299543&shareId=1',
    ))).toBe(true)
    expect(parser.canParse(url('http://www.showstart.com/event/299543'))).toBe(false)
    expect(parser.canParse(url('https://showstart.com/event/299543'))).toBe(false)
    expect(parser.canParse(url('https://www.showstart.com.evil.test/event/299543'))).toBe(false)
    expect(parser.canParse(url('https://www.showstart.com/artist/299543'))).toBe(false)
    expect(parser.canParse(url(
      'https://wap.showstart.com/pages/activity/detail/detail?activityId=invalid',
    ))).toBe(false)

    expect(normalizeShowstartUrl(url(
      'https://wap.showstart.com/pages/activity/detail/detail?activityId=299543&shareId=1',
    )).href).toBe('https://www.showstart.com/event/299543')
  })

  it('requests the normalized desktop page and parses its Nuxt payload', async () => {
    const getText = vi.fn().mockResolvedValue(showstartFixture)
    const parsed = await new ShowstartParser({ getText }).parse(url(
      'https://wap.showstart.com/pages/activity/detail/detail?activityId=299543',
    ))

    expect(getText).toHaveBeenCalledWith(url('https://www.showstart.com/event/299543'))
    expect(parsed).toEqual({
      platformName: '秀动',
      name: '北京丨音乐剧《时光代理人》特别场',
      play: '时光代理人',
      startedAtMs: new Date(2026, 5, 14, 19, 30).getTime(),
      city: '北京',
      venue: 'Blue Note Beijing',
      artistNames: ['演员甲', '演员乙'],
      coverUrl: 'https://s2.showstart.com/img/poster.jpg',
    })
  })

  it('keeps a missing date empty and rejects missing embedded data', () => {
    const withoutDate = showstartFixture.replace('06月14日 19:30-06月14日 21:00', '')
    expect(parseShowstartHtml(withoutDate).startedAtMs).toBeNull()
    expect(() => parseShowstartHtml('<html></html>')).toThrowError(ParsePlatformError)
    expect(() => parseShowstartHtml(
      '<script>window.__NUXT__={data:[{detail:{poster:"cover"}}]}</script>',
    )).toThrowError(ParsePlatformError)
  })

  it('extracts a mobile Showstart link from shared text without browser URL APIs', () => {
    vi.stubGlobal('URL', undefined)
    try {
      expect(extractFirstHttpUrl(
        '秀动演出 https://wap.showstart.com/pages/activity/detail/detail?activityId=299543 点击查看',
      )?.href).toBe(
        'https://wap.showstart.com/pages/activity/detail/detail?activityId=299543',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('Shanghai Culture Square parser', () => {
  it('accepts only the exact iOS-supported host and path with a numeric program ID', () => {
    const parser = new ShcstheatreParser({ getText: vi.fn() })
    expect(parser.canParse(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&headtype=YanChu&ARTICLE_ID=41892',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?ARTICLE_ID=41892',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892',
    ))).toBe(true)
    expect(parser.canParse(url(
      'http://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://www.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://m.shcstheatre.com.evil.test/Program/ProgramDetailsWeChat.aspx?id=41892',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://m.shcstheatre.com/Program/ProgramDetails.aspx?id=41892',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=bad',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&ARTICLE_ID=41919',
    ))).toBe(false)
  })

  it('normalizes query variants before requesting the mobile detail page', async () => {
    const source = url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?ARTICLE_ID=41892&from=share',
    )
    expect(normalizeShcstheatreUrl(source).href).toBe(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&headtype=YanChu&ARTICLE_ID=41892',
    )

    const getText = vi.fn().mockResolvedValue(shcstheatreFixture)
    const parsed = await new ShcstheatreParser({ getText }).parse(source)
    expect(getText).toHaveBeenCalledWith(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&headtype=YanChu&ARTICLE_ID=41892',
    ))
    expect(parsed).toEqual({
      platformName: '上海文化广场',
      name: '音乐剧《粉丝来信》中文版',
      play: '粉丝来信',
      startedAtMs: null,
      city: '上海',
      venue: '上海文化广场·主剧场',
      artistNames: [],
      coverUrl: 'https://pic.shcstheatre.com/upload/program/cover.jpg',
    })
  })

  it('keeps unavailable fields empty and rejects missing or malformed program data', () => {
    const groundOnly = shcstheatreFixture.replace(
      '"VC_VENUE_IDNAME": "主剧场",',
      '"VC_VENUE_IDNAME": "",',
    )
    expect(parseShcstheatreHtml(groundOnly).venue).toBe('上海文化广场')
    expect(() => parseShcstheatreHtml('<html></html>')).toThrowError(ParsePlatformError)
    expect(() => parseShcstheatreHtml(
      '<script>const data = {"SCS_WEB_BRIEFNAME": "bad\\q"};</script>',
    )).toThrowError(ParsePlatformError)
  })

  it('extracts the link from complete Shanghai Culture Square share text', () => {
    expect(extractFirstHttpUrl(
      '【上海文化广场】https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&headtype=YanChu&ARTICLE_ID=41892【杂技剧《战上海》】点击查看',
    )).toEqual(url(
      'https://m.shcstheatre.com/Program/ProgramDetailsWeChat.aspx?id=41892&headtype=YanChu&ARTICLE_ID=41892',
    ))
  })
})

describe('Poly parser', () => {
  it('accepts the four iOS-supported URL variants and rejects nearby invalid links', () => {
    const parser = new PolyParser({ getJson: vi.fn() })
    expect(parser.canParse(url(
      'https://weixin.polyt.cn/#/projectdetail/9104700/null?theaterId=760',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://m.polyt.cn/#/projectdetail/9104700/null?theaterId=760',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://weixin.polyt.cn/thh5/#/projectdetail/9104700/null?theaterId=760',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://www.polyt.cn/#/detail?productId=9104700',
    ))).toBe(true)
    expect(parser.canParse(url(
      'http://weixin.polyt.cn/#/projectdetail/9104700/null?theaterId=760',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://weixin.polyt.cn.evil.test/#/projectdetail/9104700/null?theaterId=760',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://weixin.polyt.cn/other/#/projectdetail/9104700/null?theaterId=760',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://weixin.polyt.cn/#/projectdetail/not-a-number/null?theaterId=760',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://weixin.polyt.cn/#/projectdetail/9104700/null?theaterId=bad',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://www.polyt.cn/#/detail?productId=bad',
    ))).toBe(false)
    expect(parser.canParse(url(
      'https://www.polyt.cn/#/details?productId=9104700',
    ))).toBe(false)
  })

  it('normalizes share links to the official JSON API and maps iOS-equivalent fields', async () => {
    const source = url(
      'https://weixin.polyt.cn/thh5/#/projectdetail/9104700/null?theaterId=760',
    )
    expect(normalizePolyUrl(source).href).toBe(
      'https://weixin.polyt.cn/platform-backend/good/project/detail/9104700?source=true',
    )

    const getJson = vi.fn().mockResolvedValue(polyFixture)
    const parsed = await new PolyParser({ getJson }).parse(source)
    expect(getJson).toHaveBeenCalledWith(normalizePolyUrl(source), {
      Channel: 'plat_h5',
      Theater: '760',
    })
    expect(parsed).toEqual({
      platformName: '保利票务',
      name: '圣彼得堡国立模范芭蕾舞团舞剧《天鹅湖》',
      play: '天鹅湖',
      startedAtMs: new Date(2026, 3, 1, 0, 0).getTime(),
      city: '长沙',
      venue: '长沙梅溪湖国际文化艺术中心大剧院',
      artistNames: [],
      coverUrl: 'https://cdn.polyt.cn/jpg/2026-02-09/poster.jpg',
    })
  })

  it('supports desktop links without a theater ID and rejects malformed API data', async () => {
    const source = url('https://www.polyt.cn/#/detail?productId=9104700')
    const getJson = vi.fn().mockResolvedValue(JSON.stringify(polyFixture))
    await new PolyParser({ getJson }).parse(source)
    expect(getJson).toHaveBeenCalledWith(normalizePolyUrl(source), { Channel: 'plat_h5' })

    expect(parsePolyResponse({ success: true, data: { productName: '无日期演出' } }).startedAtMs)
      .toBeNull()
    expect(() => parsePolyResponse({ success: false, data: null }))
      .toThrowError(ParsePlatformError)
    expect(() => parsePolyResponse('{bad json'))
      .toThrowError(ParsePlatformError)
  })

  it('extracts a Poly link from complete share text before routing', () => {
    expect(extractFirstHttpUrl(
      '【保利票务】https://weixin.polyt.cn/thh5/#/projectdetail/9104700/null?theaterId=760【舞剧《天鹅湖》】点击链接可直接查看',
    )).toEqual(url(
      'https://weixin.polyt.cn/thh5/#/projectdetail/9104700/null?theaterId=760',
    ))
  })
})

describe('parsed-link field application', () => {
  const parsed: ParsePlatformResult = parseDamaiHtml(fixture)

  it('preprocesses complete share text before routing every platform link', () => {
    expect(extractFirstHttpUrl(
      '&&`buhwhux,215614-3695768&&【秀动】https://wap.showstart.com/pages/activity/detail/detail?activityId=304705【贰佰2026「贰话不说」巡演-杭州站】点击链接可直接查看，或复制整段后打开秀动app查看',
    )).toEqual(url(
      'https://wap.showstart.com/pages/activity/detail/detail?activityId=304705',
    ))
    expect(extractFirstHttpUrl(
      '【大麦】https://m.damai.cn/shows/item.html?itemId=1061626307208【演出详情】',
    )).toEqual(url('https://m.damai.cn/shows/item.html?itemId=1061626307208'))
    expect(extractFirstHttpUrl(
      '猫眼：https://show.maoyan.com/qqw#/detail/387805，点击查看。',
    )).toEqual(url('https://show.maoyan.com/qqw#/detail/387805'))
    expect(extractFirstHttpUrl(
      '【保利票务】https://weixin.polyt.cn/#/projectdetail/9104700/null?theaterId=760【天鹅湖】',
    )).toEqual(url(
      'https://weixin.polyt.cn/#/projectdetail/9104700/null?theaterId=760',
    ))
  })

  it('extracts only the first link and trims trailing share punctuation', () => {
    expect(extractFirstHttpUrl(
      '先看 https://www.showstart.com/event/304705, 备用 https://www.showstart.com/event/299543',
    )).toEqual(url('https://www.showstart.com/event/304705'))
    expect(extractFirstHttpUrl('没有链接的分享文案')).toBeNull()
  })

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
