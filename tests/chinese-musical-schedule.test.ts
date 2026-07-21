import { describe, expect, it } from 'vitest'

import { PerformanceStatus } from '@/domain/performance'
import {
  applyChineseMusicalSchedule,
  parseChineseMusicalArtists,
  parseChineseMusicalArtistSchedules,
  parseDayScheduleResponse,
  parsePlayScheduleResponse,
  type ChineseMusicalSchedule,
} from '@/features/performances/chinese-musical-schedule'
import { createEmptyPerformanceDraft } from '@/features/performances/editor'

describe('Chinese musical schedule API parsing', () => {
  it('parses day and play JSON responses into the same editor shape', () => {
    const day = parseDayScheduleResponse({
      date: '2026-07-21',
      city: '上海',
      show_list: [{
        musical: '危险游戏',
        time: '19:30',
        theatre: '上海共舞台',
        cast: [
          { role: '内森', artist: '钟嘉诚' },
          { role: '理查德', artist: '刘令飞' },
        ],
      }],
    }, '2026-07-21', '上海')

    expect(day).toHaveLength(1)
    expect(day[0]).toMatchObject({
      name: '危险游戏',
      city: '上海',
      venue: '上海共舞台',
      artists: ['钟嘉诚', '刘令飞'],
      play: '危险游戏',
    })
    expect(new Date(day[0]!.startedAtMs).getHours()).toBe(19)

    const byPlay = parsePlayScheduleResponse(JSON.stringify({
      show_list: [{
        city: '广州',
        time: '2026-07-24 19:30',
        theatre: '阿波罗尼亚·广州馆',
        cast: [{ role: 'Richard', artist: '郑金铠' }],
      }],
    }), '阿波罗尼亚')

    expect(byPlay[0]).toMatchObject({
      name: '阿波罗尼亚',
      city: '广州',
      venue: '阿波罗尼亚·广州馆',
      artists: ['郑金铠'],
      play: '阿波罗尼亚',
    })
  })

  it('parses artist search and the selected artist schedule table', () => {
    const searchHtml = `
      <div class="item"><a href="/yyj/artist/17/">郑棋元</a></div>
      <div class="item"><a href="/yyj/artist/17/">郑棋元</a></div>
      <a href="/yyj/musical/1/">不是演员</a>
    `
    expect(parseChineseMusicalArtists(searchHtml)).toEqual([
      { name: '郑棋元', path: '/yyj/artist/17/' },
    ])

    const detailHtml = `
      <table><tbody><tr>
        <td>9月25日 星期五<br>19:30</td>
        <td><a href="/yyj/musical/462/">狂飙</a></td>
        <td>高启强</td>
        <td><a href="/yyj/artist/712/">高雨晨</a><a href="/yyj/artist/2872/">王瑞</a></td>
        <td><a href="/yyj/city/10/">成都</a><a href="/yyj/stage/100/">成都城市音乐厅歌剧厅</a></td>
      </tr></tbody></table>
    `
    const schedules = parseChineseMusicalArtistSchedules(
      detailHtml,
      '郑棋元',
      new Date(2026, 6, 21),
    )
    expect(schedules[0]).toMatchObject({
      name: '狂飙',
      city: '成都',
      venue: '成都城市音乐厅歌剧厅',
      artists: ['郑棋元', '高雨晨', '王瑞'],
      play: '狂飙',
    })
    expect(new Date(schedules[0]!.startedAtMs).getMonth()).toBe(8)
  })
})

describe('Chinese musical schedule form application', () => {
  it('only applies checked fields and preserves the current draft for unchecked fields', () => {
    const destination = createEmptyPerformanceDraft(new Date(2026, 0, 1, 10).getTime())
    destination.name = '保留名称'
    destination.city = '北京'
    destination.venue = '保留场地'
    destination.status = PerformanceStatus.PendingSale
    destination.facets = { play: ['保留剧目'], artist: ['保留阵容'] }

    const schedule: ChineseMusicalSchedule = {
      id: 'schedule',
      name: '危险游戏',
      startedAtMs: new Date(2026, 6, 21, 19, 30).getTime(),
      city: '上海',
      venue: '上海共舞台',
      artists: ['钟嘉诚', '刘令飞'],
      play: '危险游戏',
    }
    const applied = applyChineseMusicalSchedule(destination, schedule, [
      'date', 'city', 'artist',
    ])

    expect(applied).toMatchObject({
      name: '保留名称',
      startedAtMs: schedule.startedAtMs,
      city: '上海',
      venue: '保留场地',
      status: PerformanceStatus.PendingSale,
      facets: { play: ['保留剧目'], artist: ['钟嘉诚', '刘令飞'] },
      coordinate: null,
    })
  })
})
