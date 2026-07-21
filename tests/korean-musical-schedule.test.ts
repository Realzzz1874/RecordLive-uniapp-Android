import { describe, expect, it } from 'vitest'

import { PerformanceStatus } from '@/domain/performance'
import { createEmptyPerformanceDraft } from '@/features/performances/editor'
import {
  applyKoreanMusicalSchedule,
  parseKoreanMusicalSchedules,
  type KoreanMusicalSchedule,
} from '@/features/performances/korean-musical-schedule'

describe('Korean musical schedule HTML parsing', () => {
  it('parses current myukit time groups, names, plays and cast lists', () => {
    const html = `
      <table class="today-table">
        <thead><tr class="today-time-key"><td>14:30</td></tr></thead>
        <tbody>
          <tr>
            <td class="title"><a href="/plays/1492"><div>베토벤</div></a></td>
            <td><span class="today-casts-list">박효신, 김지우, 김도현</span></td>
          </tr>
        </tbody>
      </table>
      <table class="today-table extra-class">
        <thead><tr class="today-time-key"><td>19:30</td></tr></thead>
        <tbody>
          <tr>
            <td class="title"><div>더 헬멧 <span>- 연극</span></div></td>
            <td><span class="today-casts-list">이석준, 김주연, 김국희</span></td>
          </tr>
        </tbody>
      </table>
    `

    const schedules = parseKoreanMusicalSchedules(html, '2026-07-21')

    expect(schedules).toHaveLength(2)
    expect(schedules[0]).toMatchObject({
      name: '베토벤',
      time: '14:30',
      play: '베토벤',
      artists: ['박효신', '김지우', '김도현'],
    })
    expect(schedules[1]).toMatchObject({
      name: '더 헬멧 - 연극',
      time: '19:30',
      play: '더 헬멧',
      artists: ['이석준', '김주연', '김국희'],
    })
    expect(new Date(schedules[0]!.startedAtMs).getHours()).toBe(14)
  })
})

describe('Korean musical schedule form application', () => {
  it('only applies checked fields and preserves unchecked editor state', () => {
    const destination = createEmptyPerformanceDraft(new Date(2026, 0, 1, 10).getTime())
    destination.name = '保留名称'
    destination.city = '上海'
    destination.venue = '保留场地'
    destination.status = PerformanceStatus.PendingSale
    destination.coordinate = { latitude: 31, longitude: 121 }
    destination.facets = { play: ['保留剧目'], artist: ['保留阵容'] }

    const schedule: KoreanMusicalSchedule = {
      id: 'schedule',
      name: '더 헬멧 - 연극',
      startedAtMs: new Date(2026, 6, 21, 19, 30).getTime(),
      time: '19:30',
      artists: ['이석준', '김주연'],
      play: '더 헬멧',
    }
    const applied = applyKoreanMusicalSchedule(destination, schedule, ['date', 'artist'])

    expect(applied).toMatchObject({
      name: '保留名称',
      startedAtMs: schedule.startedAtMs,
      city: '上海',
      venue: '保留场地',
      status: PerformanceStatus.PendingSale,
      coordinate: { latitude: 31, longitude: 121 },
      facets: { play: ['保留剧目'], artist: ['이석준', '김주연'] },
    })
  })
})
