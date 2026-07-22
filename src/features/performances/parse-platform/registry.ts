import { BjConcertHallParser } from './bjconcerthall'
import { ChncpaParser } from './chncpa'
import { CitylineParser } from './cityline'
import { DamaiParser } from './damai'
import { KlookParser } from './klook'
import { MaitixParser } from './maitix'
import { MaoyanParser } from './maoyan'
import { PiaowutongParser } from './piaowutong'
import { ParsePlatformRouter } from './router'
import { PolyParser } from './poly'
import { ShcstheatreParser } from './shcstheatre'
import { ShowstartParser } from './showstart'

export const SUPPORTED_PARSE_PLATFORM_NAMES = [
  '大麦',
  '猫眼',
  '秀动',
  '上海文化广场',
  '保利票务',
  '票务通',
  'cityline',
  '国家大剧院',
  '北京音乐厅',
  '北京人艺票务中心',
  '天津中华剧院',
  '北京吉祥大戏院',
  '北京长安大戏院',
  '北京人民剧场',
  '北京梅兰芳大剧院',
  'Klook',
] as const

export function createParsePlatformRouter(): ParsePlatformRouter {
  return new ParsePlatformRouter([
    new DamaiParser(),
    new MaoyanParser(),
    new ShowstartParser(),
    new ShcstheatreParser(),
    new PolyParser(),
    new PiaowutongParser(),
    new CitylineParser(),
    new ChncpaParser(),
    // bjyyt.maitix.com 同时符合麦田白标域名，必须先交给北京音乐厅专用解析器。
    new BjConcertHallParser(),
    new MaitixParser(),
    new KlookParser(),
  ])
}
