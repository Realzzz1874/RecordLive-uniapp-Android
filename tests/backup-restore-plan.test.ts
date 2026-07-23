import { describe, expect, it } from 'vitest'

import type { AndroidBackupDataV1 } from '@/domain/backup'
import {
  planRestore,
  type CurrentRestoreState,
} from '@/domain/backup-restore-plan'

const timestamp = 1_784_201_400_000
const hash = 'a'.repeat(64)

describe('Android backup restore planner', () => {
  it('plans an exact replacement snapshot', () => {
    const backup = data({
      performances: [performance('p-backup', '备份演出')],
      categories: [reference('c-backup', '音乐会')],
      settings: [{ key: 'recordlive.theme-preference', value: 'dark', updatedAtMs: timestamp }],
    })

    const plan = planRestore(current(data({
      performances: [performance('p-local', '本机演出')],
    })), backup, 'replace-all', context())

    expect(plan.data).toEqual(backup)
    expect(plan.summary.performancesAdded).toBe(1)
    expect(plan.planFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('merges with local scalar fields winning and multi-value relationships unioned', () => {
    const local = data({
      performances: [performance('p-1', '本机名称')],
      tags: [reference('t-local', '摇滚')],
      performanceTags: [{ performanceId: 'p-1', tagId: 't-local', createdAtMs: timestamp }],
      performanceFacets: [{ performanceId: 'p-1', kind: 'artist', value: '本机艺人', sortOrder: 0 }],
    })
    const backup = data({
      performances: [performance('p-1', '备份名称')],
      tags: [reference('t-backup', ' 摇滚 '), reference('t-new', '现场')],
      performanceTags: [
        { performanceId: 'p-1', tagId: 't-backup', createdAtMs: timestamp },
        { performanceId: 'p-1', tagId: 't-new', createdAtMs: timestamp },
      ],
      performanceFacets: [
        { performanceId: 'p-1', kind: 'artist', value: '本机艺人', sortOrder: 0 },
        { performanceId: 'p-1', kind: 'artist', value: '备份艺人', sortOrder: 1 },
      ],
    })

    const plan = planRestore(current(local), backup, 'merge-local-first', context())

    expect(plan.data.performances[0].name).toBe('本机名称')
    expect(plan.data.tags.map(({ id }) => id)).toEqual(['t-local', 't-new'])
    expect(plan.data.performanceTags).toContainEqual({
      performanceId: 'p-1',
      tagId: 't-new',
      createdAtMs: timestamp,
    })
    expect(plan.data.performanceFacets.map(({ value }) => value)).toEqual(['本机艺人', '备份艺人'])
    expect(plan.summary.conflictsSkipped).toBeGreaterThan(0)
  })

  it('revives tombstoned IDs and reports suspected duplicate performances without merging them', () => {
    const local = data({
      performances: [performance('p-local', '同一场', { city: '上海', venue: '场馆' })],
    })
    const backup = data({
      performances: [
        performance('p-other', '同一场', { city: '上海', venue: '场馆' }),
        performance('p-deleted', '已删除后恢复'),
      ],
      categories: [reference('c-deleted', '戏剧')],
    })
    const state = current(local)
    state.deletedPerformanceIds = ['p-deleted']
    state.deletedCategoryIds = ['c-deleted']

    const plan = planRestore(state, backup, 'merge-local-first', context())

    expect(plan.data.performances).toHaveLength(3)
    expect(plan.summary.performancesRevived).toBe(1)
    expect(plan.summary.referencesRevived).toBe(1)
    expect(plan.summary.suspectedDuplicates).toBe(1)
    expect(plan.warnings[0]).toContain('UUID 不同')
  })

  it('is deterministic and idempotent for repeated merge imports', () => {
    const local = data({
      performances: [performance('p-local', '本机')],
      songs: [{
        id: 'song-conflict',
        performanceId: 'p-local',
        artistName: 'A',
        titles: ['A1'],
        createdAtMs: timestamp,
        updatedAtMs: timestamp,
      }],
    })
    const backup = data({
      performances: [performance('p-backup', '备份')],
      songs: [{
        id: 'song-conflict',
        performanceId: 'p-backup',
        artistName: 'B',
        titles: ['B1'],
        createdAtMs: timestamp,
        updatedAtMs: timestamp,
      }],
    })
    const first = planRestore(current(local), backup, 'merge-local-first', context())
    const repeated = planRestore(current(first.data), backup, 'merge-local-first', context())
    const sameAgain = planRestore(current(local), backup, 'merge-local-first', context())

    expect(first.planFingerprint).toBe(sameAgain.planFingerprint)
    expect(first.data.songs).toHaveLength(2)
    expect(repeated.data.songs).toHaveLength(2)
    expect(repeated.summary.songsAdded).toBe(0)
  })
})

function current(value: AndroidBackupDataV1): CurrentRestoreState {
  return {
    data: value,
    deletedCategoryIds: [],
    deletedTagIds: [],
    deletedPerformanceIds: [],
    mediaRelativePaths: Object.fromEntries(value.mediaAssets.map(({ id }) => [id, `_doc/${id}.jpg`])),
  }
}

function context() {
  return { operationId: 'test-operation', appliedAtMs: timestamp + 1 }
}

function data(overrides: Partial<AndroidBackupDataV1> = {}): AndroidBackupDataV1 {
  return {
    performances: [],
    categories: [],
    tags: [],
    performanceTags: [],
    performanceFacets: [],
    songs: [],
    mediaAssets: [],
    settings: [],
    ...overrides,
  }
}

function performance(
  id: string,
  name: string,
  overrides: Partial<AndroidBackupDataV1['performances'][number]> = {},
): AndroidBackupDataV1['performances'][number] {
  return {
    id,
    name,
    startedAtMs: timestamp,
    city: '',
    venue: '',
    remark: '',
    ticketPriceAmount: '0',
    ticketPriceCurrency: 'CNY',
    paidPriceAmount: '0',
    paidPriceCurrency: 'CNY',
    otherCostAmount: '0',
    otherCostCurrency: 'CNY',
    seat: '',
    rating: 0,
    status: 0,
    categoryId: null,
    latitude: null,
    longitude: null,
    createdAtMs: timestamp,
    updatedAtMs: timestamp,
    ...overrides,
  }
}

function reference(id: string, name: string): AndroidBackupDataV1['categories'][number] {
  return { id, name, sortOrder: 0, createdAtMs: timestamp, updatedAtMs: timestamp }
}
