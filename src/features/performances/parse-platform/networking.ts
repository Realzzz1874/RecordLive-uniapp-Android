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
const PAGE_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
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
        ...headers,
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
        'User-Agent': PAGE_USER_AGENT,
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
  return '大麦'
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
