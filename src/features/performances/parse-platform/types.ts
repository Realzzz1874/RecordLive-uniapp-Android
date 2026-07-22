import type { ParsePlatformUrl } from './url'

export interface ParsePlatformResult {
  platformName: string
  name: string
  play: string
  startedAtMs: number | null
  city: string
  venue: string
  artistNames: string[]
  coverUrl: string
}

export type ParsePlatformErrorCode =
  | 'unsupported-url'
  | 'invalid-url'
  | 'request-failed'
  | 'invalid-response'
  | 'parsing-failed'

export class ParsePlatformError extends Error {
  constructor(
    readonly code: ParsePlatformErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ParsePlatformError'
  }
}

export interface ParsePlatformParser {
  readonly platformName: string
  canParse(url: ParsePlatformUrl): boolean
  parse(url: ParsePlatformUrl): Promise<ParsePlatformResult>
}

export interface ParsePlatformHttpClient {
  getText(url: ParsePlatformUrl): Promise<string>
}

export interface ParsePlatformJsonClient {
  getJson(
    url: ParsePlatformUrl,
    headers?: Record<string, string>,
  ): Promise<unknown>
}
