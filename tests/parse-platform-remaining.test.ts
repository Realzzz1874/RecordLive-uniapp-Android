import { describe, expect, it, vi } from 'vitest'

import { BjConcertHallParser, parseBjConcertHallResponses } from '@/features/performances/parse-platform/bjconcerthall'
import { ChncpaParser, normalizeChncpaUrl, parseChncpaResponse } from '@/features/performances/parse-platform/chncpa'
import { CitylineParser, normalizeCitylineUrl, parseCitylineResponse } from '@/features/performances/parse-platform/cityline'
import { KlookParser, parseKlookHtml } from '@/features/performances/parse-platform/klook'
import { MaitixParser, parseMaitixResponse } from '@/features/performances/parse-platform/maitix'
import {
  defaultParsePlatformHttpClient,
  defaultParsePlatformJsonClient,
  platformAssetUrl,
} from '@/features/performances/parse-platform/networking'
import { PiaowutongParser, parsePiaowutongHtml } from '@/features/performances/parse-platform/piaowutong'
import { ParsePlatformError } from '@/features/performances/parse-platform/types'
import { parseHttpUrl, type ParsePlatformUrl } from '@/features/performances/parse-platform/url'

describe('Piaowutong parser', () => {
  const fixture = `
    <div class="detail-img"><img src="https://img.piaowutong.com/poster.jpg"></div>
    <h3 class="detail-title">李胜素、于魁智联袂京剧《穆桂英挂帅》</h3>
    <div class="main_info_p2_div">2026年03月15日 19:30</div>
    <span class="address-main"><!-- venue placeholder --></span>
    <span class="address-main">顺义大剧院</span>
  `

  it('accepts only exact mobile ticket routes and maps the iOS page fields', async () => {
    const parser = new PiaowutongParser({ getText: vi.fn().mockResolvedValue(fixture) })
    expect(parser.canParse(url('https://m.piaowutong.com/ticket/3/20409.html?siteId=41'))).toBe(true)
    expect(parser.canParse(url('https://m.0368.com/ticket/20/23586.html?siteId=75'))).toBe(true)
    expect(parser.canParse(url('https://m.piaowutong.com.evil.test/ticket/3/20409.html'))).toBe(false)
    expect(parser.canParse(url('http://m.piaowutong.com/ticket/3/20409.html'))).toBe(false)

    expect(parsePiaowutongHtml(fixture)).toEqual({
      platformName: '票务通',
      name: '李胜素、于魁智联袂京剧《穆桂英挂帅》',
      play: '穆桂英挂帅',
      startedAtMs: new Date(2026, 2, 15, 19, 30).getTime(),
      city: '北京',
      venue: '顺义大剧院',
      artistNames: [],
      coverUrl: 'https://img.piaowutong.com/poster.jpg',
    })
  })
})

describe('Cityline parser', () => {
  const fixture = {
    content: {
      titleSc: '2026 ZICO LIVE : HONG KONG HIGHWAY',
      venueSc: '亚洲国际博览馆7号展馆',
      bannerUrlSc: '/images/2026/poster.jpg',
      perfDateSc: '2026年9月26日（星期六）晚上7时正',
    },
  }

  it('converts a simplified-Chinese event page to the public JSON contract', async () => {
    const source = url('https://shows.cityline.com/sc/2026/zicolive2026.html')
    const getJson = vi.fn().mockResolvedValue(fixture)
    const parser = new CitylineParser({ getJson })
    expect(parser.canParse(source)).toBe(true)
    expect(parser.canParse(url('https://shows.cityline.com/tc/2026/zicolive2026.html'))).toBe(false)
    expect(parser.canParse(url('https://shows.cityline.com.evil.test/sc/2026/zicolive2026.html'))).toBe(false)
    expect(normalizeCitylineUrl(source).href).toBe('https://shows.cityline.com/data/2026/zicolive2026.json')

    await expect(parser.parse(source)).resolves.toEqual(parseCitylineResponse(fixture))
    expect(parseCitylineResponse(fixture)).toMatchObject({
      platformName: 'cityline',
      name: fixture.content.titleSc,
      startedAtMs: null,
      city: '',
      venue: fixture.content.venueSc,
      coverUrl: 'https://shows.cityline.com/images/2026/poster.jpg',
    })
  })
})

describe('National Centre for the Performing Arts parser', () => {
  const fixture = {
    code: '0',
    data: {
      productName: '音乐舞台《感觉》——梦回迈克尔·杰克逊巨星时刻',
      venueName: '北京艺术中心 - 歌剧院',
      productImageMax: 'https://www.chncpa.org/cover.jpg',
      calendar: [
        { sessionDate: '2026-07-24 周五 19:30' },
        { sessionDate: '2026-07-23 周四 19:30' },
      ],
      introduce: [
        { type: '40', contents: [{ artistName: '演员甲' }, { artistName: '演员甲' }] },
        { type: '41', contents: [{ artistName: '演员乙' }] },
      ],
    },
  }

  it('uses the official JSON API and chooses the earliest session', () => {
    const parser = new ChncpaParser({ getJson: vi.fn() })
    const source = url('https://m.chncpa.org/product.html?id=10002636')
    expect(parser.canParse(source)).toBe(true)
    expect(parser.canParse(url('https://wticket.chncpa.org/product.html?id=10002636'))).toBe(true)
    expect(parser.canParse(url('https://m.chncpa.org.evil.test/product.html?id=10002636'))).toBe(false)
    expect(normalizeChncpaUrl(source).href)
      .toBe('https://openapi.chncpa.org/product/detail?productId=10002636&channel=wap')
    expect(parseChncpaResponse(fixture)).toEqual({
      platformName: '国家大剧院',
      name: fixture.data.productName,
      play: '感觉',
      startedAtMs: new Date(2026, 6, 23, 19, 30).getTime(),
      city: '北京',
      venue: fixture.data.venueName,
      artistNames: ['演员甲', '演员乙'],
      coverUrl: fixture.data.productImageMax,
    })
  })
})

describe('Beijing Concert Hall parser', () => {
  const project = {
    code: 200,
    data: {
      projectName: '中国交响乐团音乐会',
      projectImgUrl: 'https://img.alicdn.com/poster.png',
    },
  }
  const events = {
    code: 200,
    data: [
      { eventStartTime: '2026-07-26 19:30' },
      { eventStartTime: '2026-07-25 19:30' },
    ],
  }

  it('owns both official and Beijing Music Hall Maitix links before generic Maitix', async () => {
    const getJson = vi.fn().mockResolvedValueOnce(project).mockResolvedValueOnce(events)
    const parser = new BjConcertHallParser({ getJson })
    expect(parser.canParse(url(
      'https://www.bjconcerthall.cn/bjyyt/ycgp/ycgpxq.shtml?projectId=238282035&eventId=269950163',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://bjyyt.maitix.com/h5#/pages-order/projectDetail/index?projectId=238282035',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://other.maitix.com/h5#/pages-order/projectDetail/index?projectId=238282035',
    ))).toBe(false)

    await parser.parse(url(
      'https://bjyyt.maitix.com/h5#/pages-order/projectDetail/index?projectId=238282035',
    ))
    expect(getJson).toHaveBeenCalledTimes(2)
    expect(parseBjConcertHallResponses(project, events)).toEqual({
      platformName: '北京音乐厅',
      name: project.data.projectName,
      play: '',
      startedAtMs: new Date(2026, 6, 25, 19, 30).getTime(),
      city: '北京',
      venue: '北京音乐厅',
      artistNames: [],
      coverUrl: project.data.projectImgUrl,
    })
  })
})

describe('Maitix parser', () => {
  const fixture = {
    code: '200',
    data: {
      projectName: '任思媛2026京剧巡演 京剧《秦香莲》与《锁麟囊》',
      imgUrl: 'https://img.alicdn.com/poster.jpg',
      cityName: '天津市',
      siteName: '中华剧院',
      startTime: 1_788_606_900_000,
      eventVoList: [{ showTime: 1_788_606_900_000 }],
    },
  }

  it('accepts white-label hosts and sends their origin to the shared API', async () => {
    const getJson = vi.fn().mockResolvedValue(fixture)
    const parser = new MaitixParser({ getJson })
    const source = url(
      'https://tjyrwh.maitix.com/h5?code=share#/pages-order/projectDetail/index?projectId=238832016',
    )
    expect(parser.canParse(source)).toBe(true)
    expect(parser.canParse(url(
      'https://www.cadxy.cn/h5#/pages-order/projectDetail/index?projectId=238814001',
    ))).toBe(true)
    expect(parser.canParse(url(
      'https://maitix.com.evil.test/h5#/pages-order/projectDetail/index?projectId=238832016',
    ))).toBe(false)

    const parsed = await parser.parse(source)
    expect(getJson).toHaveBeenCalledWith(
      url('https://client.maitix.com/api/pro/project?projectToken=238832016&reqType=1'),
      {
        Origin: 'https://tjyrwh.maitix.com',
        Referer: 'https://tjyrwh.maitix.com/',
        'X-Parse-Origin': 'https://tjyrwh.maitix.com',
      },
    )
    expect(parsed).toEqual({
      platformName: '天津中华剧院',
      name: fixture.data.projectName,
      play: '秦香莲__PLAY__锁麟囊',
      startedAtMs: fixture.data.startTime,
      city: '天津',
      venue: '中华剧院',
      artistNames: [],
      coverUrl: fixture.data.imgUrl,
    })
    expect(() => parseMaitixResponse({ code: '200', data: null })).toThrowError(ParsePlatformError)
  })

  it('uses the concrete iOS platform name for the Chang An Theatre entry', async () => {
    const getJson = vi.fn().mockResolvedValue({
      code: '200',
      data: {
        projectName: '长安大戏院经典折子戏展演《闹天宫》',
        cityName: '北京市',
        siteName: '长安大戏院',
        startTime: 1_784_287_800_000,
      },
    })
    const parsed = await new MaitixParser({ getJson }).parse(url(
      'https://www.cadxy.cn/h5#/pages-order/projectDetail/index?projectId=238814001',
    ))
    expect(parsed.platformName).toBe('北京长安大戏院')
  })
})

describe('Klook parser', () => {
  const fixture = `
    <script>
      window.__KLOOK__={"state":{"event-vertical":{"detail":{"detailInfo":{
        "title":"PARK JI HOON ASIA FANCON RE:FLECT IN MACAU",
        "city_name":"中国澳门",
        "image_url":"https://res.klook.com/poster.jpg",
        "date_range_list":[{"start":"2026-08-08","end":"2026-08-08"}],
        "address":{"title":"澳门上葡京综合度假村"},
        "ticket_info":"日期：2026年8月8日 时间：晚上6时",
        "seo":{"keywords":"[\\"PARK JI HOON\\",\\"MACAU\\"]"}
      }}}}};
    </script>
  `

  it('supports canonical and short links and parses the embedded JSON without DOM APIs', async () => {
    const getText = vi.fn().mockResolvedValue(fixture)
    const parser = new KlookParser({ getText })
    expect(parser.canParse(url(
      'https://www.klook.cn/zh-CN/event-detail/102000992-park-ji-hoon-mo/',
    ))).toBe(true)
    expect(parser.canParse(url('https://s.klook.cn/c/jy2ardPlYX'))).toBe(true)
    expect(parser.canParse(url('https://s.klook.cn/jy2ardPlYX'))).toBe(true)
    expect(parser.canParse(url('https://www.klook.cn.evil.test/zh-CN/event-detail/102000992-x'))).toBe(false)

    const parsed = await parser.parse(url(
      'https://www.klook.cn/zh-CN/event-detail/102000992-park-ji-hoon-mo/',
    ))
    expect(parsed).toEqual({
      platformName: 'Klook',
      name: 'PARK JI HOON ASIA FANCON RE:FLECT IN MACAU',
      play: '',
      startedAtMs: new Date(2026, 7, 8, 18, 0).getTime(),
      city: '澳门',
      venue: '澳门上葡京综合度假村',
      artistNames: ['PARK JI HOON'],
      coverUrl: 'https://res.klook.com/poster.jpg',
    })
    expect(parseKlookHtml(fixture)).toEqual(parsed)
    expect(() => parseKlookHtml('<html></html>')).toThrowError(ParsePlatformError)
  })
})

describe('remaining platform networking', () => {
  it('keeps Android requests direct and removes the H5-only Maitix forwarding header', async () => {
    const request = vi.fn((options: {
      url: string
      header: Record<string, string>
      success: (result: { statusCode: number; data: unknown }) => void
    }) => options.success({ statusCode: 200, data: { code: '200' } }))
    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'app' }),
      request,
    })
    const api = url('https://client.maitix.com/api/pro/project?projectToken=238832016&reqType=1')
    await defaultParsePlatformJsonClient.getJson(api, {
      Origin: 'https://tjyrwh.maitix.com',
      Referer: 'https://tjyrwh.maitix.com/',
      'X-Parse-Origin': 'https://tjyrwh.maitix.com',
    })
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      url: api.href,
      header: {
        Accept: 'application/json',
        Origin: 'https://tjyrwh.maitix.com',
        Referer: 'https://tjyrwh.maitix.com/',
      },
    })
    expect(request.mock.calls[0]?.[0].header).not.toHaveProperty('X-Parse-Origin')
    vi.unstubAllGlobals()
  })

  it('uses H5 development proxies without setting browser-unsafe request headers', async () => {
    const request = vi.fn((options: {
      url: string
      header: Record<string, string>
      success: (result: { statusCode: number; data: unknown }) => void
    }) => options.success({ statusCode: 200, data: '<html></html>' }))
    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'web' }),
      request,
    })

    await defaultParsePlatformJsonClient.getJson(
      url('https://client.maitix.com/api/pro/project?projectToken=1&reqType=1'),
      {
        Origin: 'https://tjyrwh.maitix.com',
        Referer: 'https://tjyrwh.maitix.com/',
        'X-Parse-Origin': 'https://tjyrwh.maitix.com',
      },
    )
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      url: '/maitix-proxy/api/pro/project?projectToken=1&reqType=1',
      header: {
        Accept: 'application/json',
        'X-Parse-Origin': 'https://tjyrwh.maitix.com',
      },
    })
    expect(request.mock.calls[0]?.[0].header).not.toHaveProperty('Origin')
    expect(request.mock.calls[0]?.[0].header).not.toHaveProperty('Referer')

    await defaultParsePlatformHttpClient.getText(url('https://s.klook.cn/c/jy2ardPlYX'))
    expect(request.mock.calls[1]?.[0].url).toBe('/klook-short-proxy/c/jy2ardPlYX')
    expect(request.mock.calls[1]?.[0].header).not.toHaveProperty('User-Agent')
    expect(platformAssetUrl('https://res.klook.com/poster.jpg'))
      .toBe('/klook-image-proxy/poster.jpg')
    expect(platformAssetUrl('https://www.chncpa.org/cover.jpg'))
      .toBe('/chncpa-image-proxy/cover.jpg')
    expect(platformAssetUrl('https://shows.cityline.com/images/poster.jpg'))
      .toBe('/cityline-image-proxy/images/poster.jpg')
    vi.unstubAllGlobals()
  })
})

function url(value: string): ParsePlatformUrl {
  const parsed = parseHttpUrl(value)
  if (!parsed) throw new Error(`Invalid test URL: ${value}`)
  return parsed
}
