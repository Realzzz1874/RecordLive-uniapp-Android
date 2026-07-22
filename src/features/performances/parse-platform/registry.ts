import { DamaiParser } from './damai'
import { MaoyanParser } from './maoyan'
import { ParsePlatformRouter } from './router'
import { PolyParser } from './poly'
import { ShcstheatreParser } from './shcstheatre'
import { ShowstartParser } from './showstart'

export const SUPPORTED_PARSE_PLATFORM_NAMES = ['大麦', '猫眼', '秀动', '上海文化广场', '保利票务'] as const

export function createParsePlatformRouter(): ParsePlatformRouter {
  return new ParsePlatformRouter([
    new DamaiParser(),
    new MaoyanParser(),
    new ShowstartParser(),
    new ShcstheatreParser(),
    new PolyParser(),
  ])
}
