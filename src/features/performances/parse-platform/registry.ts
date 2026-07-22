import { DamaiParser } from './damai'
import { MaoyanParser } from './maoyan'
import { ParsePlatformRouter } from './router'
import { ShowstartParser } from './showstart'

export const SUPPORTED_PARSE_PLATFORM_NAMES = ['大麦', '猫眼', '秀动'] as const

export function createParsePlatformRouter(): ParsePlatformRouter {
  return new ParsePlatformRouter([
    new DamaiParser(),
    new MaoyanParser(),
    new ShowstartParser(),
  ])
}
