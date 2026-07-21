import {
  ParsePlatformError,
  type ParsePlatformParser,
  type ParsePlatformResult,
} from './types'
import type { ParsePlatformUrl } from './url'

export class ParsePlatformRouter {
  constructor(private readonly parsers: readonly ParsePlatformParser[]) {}

  parserFor(url: ParsePlatformUrl): ParsePlatformParser {
    const parser = this.parsers.find((item) => item.canParse(url))
    if (!parser) throw new ParsePlatformError('unsupported-url', '暂不支持这个链接')
    return parser
  }

  async parse(url: ParsePlatformUrl): Promise<ParsePlatformResult> {
    return this.parserFor(url).parse(url)
  }
}
