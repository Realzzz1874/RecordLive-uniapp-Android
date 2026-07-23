import type { SelectedImage } from '@/platform/media/types'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformJsonClient,
} from './types'
import { parseHttpUrl, type ParsePlatformUrl } from './url'

const DAMAI_DETAIL_HOST = 'detail.damai.cn'
const DAMAI_IMAGE_HOST = 'img.alicdn.com'
const MAOYAN_DETAIL_HOST = 'www.gewara.com'
const MAOYAN_IMAGE_HOST = 'p0.meituan.net'
const SHOWSTART_DETAIL_HOST = 'www.showstart.com'
const SHOWSTART_IMAGE_HOST = 's2.showstart.com'
const SHCSTHEATRE_DETAIL_HOST = 'm.shcstheatre.com'
const SHCSTHEATRE_IMAGE_HOST = 'pic.shcstheatre.com'
const POLY_DETAIL_HOST = 'weixin.polyt.cn'
const POLY_IMAGE_HOST = 'cdn.polyt.cn'
const PIAOWUTONG_HOSTS = new Set(['piaowutong.com', 'm.piaowutong.com'])
const PIAOWUTONG_ALT_HOST = 'm.0368.com'
const PIAOWUTONG_IMAGE_HOST = 'img.piaowutong.com'
const CITYLINE_HOST = 'shows.cityline.com'
const CHNCPA_API_HOST = 'openapi.chncpa.org'
const CHNCPA_IMAGE_HOST = 'www.chncpa.org'
const BJ_CONCERT_HALL_HOST = 'www.bjconcerthall.cn'
const MAITIX_API_HOST = 'client.maitix.com'
const KLOOK_SHORT_HOST = 's.klook.cn'
const KLOOK_LINK_HOST = 'short.klook.cn'
const KLOOK_IMAGE_HOST = 'res.klook.com'
const ANDROID_IMAGE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'

export const defaultParsePlatformHttpClient: ParsePlatformHttpClient = {
  getText(url) {
    return requestText(platformRequestUrl(url), platformName(url))
  },
}

export const defaultParsePlatformJsonClient: ParsePlatformJsonClient = {
  getJson(url, headers = {}) {
    return requestJson(platformRequestUrl(url), platformName(url), headers)
  },
}

export function platformAssetUrl(value: string): string {
  const url = toUrl(value)
  if (!url || isAppPlatform()) return value
  if (url.hostname === DAMAI_IMAGE_HOST) return `/damai-image-proxy${url.pathname}${url.search}`
  if (url.hostname === MAOYAN_IMAGE_HOST) return `/maoyan-image-proxy${url.pathname}${url.search}`
  if (url.hostname === SHOWSTART_IMAGE_HOST) return `/showstart-image-proxy${url.pathname}${url.search}`
  if (url.hostname === SHCSTHEATRE_IMAGE_HOST) return `/shcstheatre-image-proxy${url.pathname}${url.search}`
  if (url.hostname === POLY_IMAGE_HOST) return `/poly-image-proxy${url.pathname}${url.search}`
  if (url.hostname === PIAOWUTONG_IMAGE_HOST) return `/piaowutong-image-proxy${url.pathname}${url.search}`
  if (url.hostname === CITYLINE_HOST) return `/cityline-image-proxy${url.pathname}${url.search}`
  if (url.hostname === CHNCPA_IMAGE_HOST) return `/chncpa-image-proxy${url.pathname}${url.search}`
  if (url.hostname === KLOOK_IMAGE_HOST) return `/klook-image-proxy${url.pathname}${url.search}`
  return value
}

export async function downloadParsePlatformImage(value: string): Promise<SelectedImage | null> {
  const url = toUrl(value)
  if (!url) return null
  const sourceUrl = isAppPlatform() ? url.href : platformAssetUrl(url.href)
  return new Promise((resolve) => {
    uni.downloadFile({
      url: sourceUrl,
      timeout: 15_000,
      header: isAppPlatform() ? { 'User-Agent': ANDROID_IMAGE_USER_AGENT } : {},
      success: ({ statusCode, tempFilePath }) => {
        if (statusCode < 200 || statusCode >= 300 || !tempFilePath) {
          resolve(null)
          return
        }
        resolve({
          sourcePath: tempFilePath,
          previewPath: tempFilePath,
          byteSize: 0,
          mimeType: inferImageMimeType(url.pathname),
        })
      },
      fail: () => resolve(null),
    })
  })
}

function platformRequestUrl(url: ParsePlatformUrl): string {
  if (!isAppPlatform() && url.hostname === DAMAI_DETAIL_HOST) {
    return `/damai-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === MAOYAN_DETAIL_HOST) {
    return `/maoyan-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === SHOWSTART_DETAIL_HOST) {
    return `/showstart-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === SHCSTHEATRE_DETAIL_HOST) {
    return `/shcstheatre-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === POLY_DETAIL_HOST) {
    return `/poly-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && PIAOWUTONG_HOSTS.has(url.hostname)) {
    return `/piaowutong-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === PIAOWUTONG_ALT_HOST) {
    return `/piaowutong-alt-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === CITYLINE_HOST) {
    return `/cityline-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === CHNCPA_API_HOST) {
    return `/chncpa-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === BJ_CONCERT_HALL_HOST) {
    return `/bjconcerthall-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === MAITIX_API_HOST) {
    return `/maitix-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === KLOOK_SHORT_HOST) {
    return `/klook-short-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && url.hostname === KLOOK_LINK_HOST) {
    return `/klook-link-proxy${url.pathname}${url.search}`
  }
  if (!isAppPlatform() && isKlookHost(url.hostname)) {
    return `/klook-proxy${url.pathname}${url.search}`
  }
  return url.href
}

function requestJson(
  url: string,
  sourceName: string,
  headers: Record<string, string>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      dataType: 'json',
      timeout: 15_000,
      header: {
        Accept: 'application/json',
        ...platformRequestHeaders(headers),
      },
      success: ({ statusCode, data }) => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new ParsePlatformError('request-failed', `${sourceName}接口请求失败（${statusCode}）`))
          return
        }
        resolve(data)
      },
      fail: () => reject(new ParsePlatformError('request-failed', `无法连接${sourceName}`)),
    })
  })
}

function requestText(url: string, sourceName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      dataType: 'text',
      timeout: 15_000,
      header: {
        Accept: 'text/html',
      },
      success: ({ statusCode, data }) => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new ParsePlatformError('request-failed', `${sourceName}页面请求失败（${statusCode}）`))
          return
        }
        if (typeof data !== 'string') {
          reject(new ParsePlatformError('invalid-response', `${sourceName}返回了无法识别的内容`))
          return
        }
        resolve(data)
      },
      fail: () => reject(new ParsePlatformError('request-failed', `无法连接${sourceName}`)),
    })
  })
}

function platformName(url: ParsePlatformUrl): string {
  if (url.hostname === MAOYAN_DETAIL_HOST) return '猫眼'
  if (url.hostname === SHOWSTART_DETAIL_HOST) return '秀动'
  if (url.hostname === SHCSTHEATRE_DETAIL_HOST) return '上海文化广场'
  if (url.hostname === POLY_DETAIL_HOST) return '保利票务'
  if (PIAOWUTONG_HOSTS.has(url.hostname) || url.hostname === PIAOWUTONG_ALT_HOST) return '票务通'
  if (url.hostname === CITYLINE_HOST) return 'Cityline'
  if (url.hostname === CHNCPA_API_HOST) return '国家大剧院'
  if (url.hostname === BJ_CONCERT_HALL_HOST) return '北京音乐厅'
  if (url.hostname === MAITIX_API_HOST) return '剧院票务'
  if (isKlookHost(url.hostname)) return 'Klook'
  return '大麦'
}

function platformRequestHeaders(headers: Record<string, string>): Record<string, string> {
  if (isAppPlatform()) {
    const { 'X-Parse-Origin': _, ...appHeaders } = headers
    return appHeaders
  }
  const { Origin: _, Referer: __, ...webHeaders } = headers
  return webHeaders
}

function isKlookHost(hostname: string): boolean {
  return hostname === 'klook.cn' || hostname.endsWith('.klook.cn')
}

function isAppPlatform(): boolean {
  return uni.getSystemInfoSync().uniPlatform === 'app'
}

function toUrl(value: string): ParsePlatformUrl | null {
  return parseHttpUrl(value)
}

function inferImageMimeType(path: string): string {
  const normalized = path.toLocaleLowerCase()
  if (normalized.endsWith('.png')) return 'image/png'
  if (normalized.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}
