import { DamaiParser } from './damai'
import { ParsePlatformRouter } from './router'

export function createParsePlatformRouter(): ParsePlatformRouter {
  return new ParsePlatformRouter([
    new DamaiParser(),
  ])
}
