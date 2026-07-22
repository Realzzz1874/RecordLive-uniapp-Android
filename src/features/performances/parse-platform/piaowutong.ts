import { parseFirstPerformanceDate } from './date'
import { defaultParsePlatformHttpClient } from './networking'
import {
  ParsePlatformError,
  type ParsePlatformHttpClient,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import type { ParsePlatformUrl } from './url'

const DETAIL_HOSTS = new Set(['piaowutong.com', 'm.piaowutong.com', 'm.0368.com'])

export class PiaowutongParser implements ParsePlatformParser {
  readonly platformName = '票务通'

  constructor(
    private readonly httpClient: ParsePlatformHttpClient = defaultParsePlatformHttpClient,
  ) {}

  canParse(url: ParsePlatformUrl): boolean {
    return url.protocol === 'https:'
      && DETAIL_HOSTS.has(url.hostname)
      && /^\/ticket\/\d+\/\d+\.html$/.test(url.pathname)
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    if (!this.canParse(url)) {
      throw new ParsePlatformError('invalid-url', '票务通链接缺少有效的演出 ID')
    }
    return parsePiaowutongHtml(await this.httpClient.getText(url))
  }
}

export function parsePiaowutongHtml(html: string): ParsePlatformResult {
  const name = elementText(html, 'h3', 'detail-title')
  if (!name) throw new ParsePlatformError('invalid-response', '票务通页面缺少演出名称')

  const dateText = elementText(html, 'div', 'main_info_p2_div')
  const venue = elementText(html, 'span', 'address-main')
  const coverUrl = imageSource(html, 'detail-img')

  return {
    platformName: '票务通',
    name,
    play: extractPlayTitles(name),
    startedAtMs: parseChineseDate(dateText),
    city: '北京',
    venue,
    artistNames: [],
    coverUrl: normalizeUrl(coverUrl),
  }
}

function elementText(html: string, tag: string, className: string): string {
  const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<${tag}\\b[^>]*class=["'][^"']*\\b${escapedClass}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'gi',
  )
  for (const match of html.matchAll(pattern)) {
    const value = decodeHtml(stripTags(match[1] ?? '')).trim()
    if (value) return value
  }
  return ''
}

function imageSource(html: string, containerClass: string): string {
  const container = new RegExp(
    `<[^>]+class=["'][^"']*\\b${containerClass}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    'i',
  ).exec(html)?.[1] ?? ''
  return /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(container)?.[1]?.trim() ?? ''
}

function parseChineseDate(value: string): number | null {
  const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:[^\d]+(\d{1,2})[:：](\d{2}))?/)
  if (!match) return null
  return parseFirstPerformanceDate(
    `${match[1]}-${match[2]}-${match[3]} ${match[4] ?? '00'}:${match[5] ?? '00'}`,
  )
}

function extractPlayTitles(name: string): string {
  return [...name.matchAll(/《([^》]+)》/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join('__PLAY__')
}

function normalizeUrl(value: string): string {
  if (value.startsWith('//')) return `https:${value}`
  return value
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
}
