import type { SelectedImage } from '@/platform/media/types'
import { ParsePlatformError, type ParsePlatformHttpClient } from './types'

const DAMAI_DETAIL_HOST = 'detail.damai.cn'
const DAMAI_IMAGE_HOST = 'img.alicdn.com'
const ANDROID_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'

export const defaultParsePlatformHttpClient: ParsePlatformHttpClient = {
  getText(url) {
    return requestText(platformRequestUrl(url))
  },
}

export function platformAssetUrl(value: string): string {
  const url = toUrl(value)
  if (!url || isAppPlatform()) return value
  if (url.hostname === DAMAI_IMAGE_HOST) return `/damai-image-proxy${url.pathname}${url.search}`
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
      header: { 'User-Agent': ANDROID_USER_AGENT },
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

function platformRequestUrl(url: URL): string {
  if (!isAppPlatform() && url.hostname === DAMAI_DETAIL_HOST) {
    return `/damai-proxy${url.pathname}${url.search}`
  }
  return url.href
}

function requestText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      dataType: 'text',
      timeout: 15_000,
      header: {
        Accept: 'text/html',
        'User-Agent': ANDROID_USER_AGENT,
      },
      success: ({ statusCode, data }) => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new ParsePlatformError('request-failed', `大麦页面请求失败（${statusCode}）`))
          return
        }
        if (typeof data !== 'string') {
          reject(new ParsePlatformError('invalid-response', '大麦返回了无法识别的内容'))
          return
        }
        resolve(data)
      },
      fail: () => reject(new ParsePlatformError('request-failed', '无法连接大麦')),
    })
  })
}

function isAppPlatform(): boolean {
  return uni.getSystemInfoSync().uniPlatform === 'app'
}

function toUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function inferImageMimeType(path: string): string {
  const normalized = path.toLocaleLowerCase()
  if (normalized.endsWith('.png')) return 'image/png'
  if (normalized.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}
