import { DamaiParser } from './damai'
import { MaoyanParser } from './maoyan'
import { ParsePlatformRouter } from './router'

export function createParsePlatformRouter(): ParsePlatformRouter {
  return new ParsePlatformRouter([
    new DamaiParser(),
    new MaoyanParser(),
  ])
}
