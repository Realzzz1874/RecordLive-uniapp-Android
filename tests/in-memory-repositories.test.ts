import { describe, expect, it } from 'vitest'

import { DomainConflictError, DomainNotFoundError } from '@/domain/errors'
import { PerformanceStatus, type Performance } from '@/domain/performance'
import type { PerformanceDraft, PerformanceRepository } from '@/features/performances/repository'
import { InMemoryPerformanceRepository } from '@/platform/repositories/in-memory-performance-repository'
import { InMemoryReferenceDataRepository } from '@/platform/repositories/in-memory-reference-data-repository'
import {
  formatPerformanceCardDate,
  formatPerformanceDate,
  formatPerformanceLocation,
  PerformanceBrowserService,
  performanceLifecycleLabel,
  performanceMediaPath,
  relativePerformanceDateText,
} from '@/features/performances/browser'
import {
  appendSelectedName,
  createEmptyPerformanceDraft,
  moveSelectedName,
  normalizePerformanceDraft,
  parseDelimitedValues,
  PerformanceEditorService,
  replaceSelectedName,
} from '@/features/performances/editor'
import {
  artistNameSuggestions,
  PREPARED_ARTIST_NAMES,
} from '@/features/performances/artist-names'
import {
  playNameSuggestions,
  PREPARED_PLAY_NAMES,
} from '@/features/performances/play-names'
import {
  DEFAULT_PURCHASE_CHANNELS,
  normalizePurchaseChannels,
  purchaseChannelOptions,
} from '@/features/performances/purchase-channels'
import {
  friendOptions,
  normalizeFriends,
} from '@/features/performances/friends'
import {
  companyNameSuggestions,
  mergeCustomCompanyNames,
  normalizeCompanyNames,
  PREPARED_COMPANY_NAMES,
} from '@/features/performances/company-names'
import type {
  PerformanceImageRole,
  PerformanceMediaStorage,
  PreparedImage,
  SelectedImage,
} from '@/platform/media/types'
import type { MediaAsset } from '@/domain/performance'
import {
  DEFAULT_BROWSE_PREFERENCES,
  normalizeBrowsePreferences,
  yearRange,
} from '@/features/preferences/model'

function performanceDraft(overrides: Partial<PerformanceDraft> = {}): PerformanceDraft {
  return {
    name: '夏日现场',
    startedAtMs: 1_800_000_000_000,
    city: '上海',
    venue: '音乐厅',
    remark: '',
    ticketPrice: { amount: '680', currency: 'CNY' },
    paidPrice: { amount: '680', currency: 'CNY' },
    otherCost: { amount: '0', currency: 'CNY' },
    seat: 'A1',
    rating: 4.5,
    status: PerformanceStatus.Normal,
    categoryId: 'concert',
    coordinate: null,
    tagIds: ['live'],
    facets: { artist: ['示例艺人'] },
    mediaAssets: [],
    ...overrides,
  }
}

describe('in-memory performance repository', () => {
  it('creates, updates, searches, pages and removes performances', async () => {
    let timestamp = 100
    const repository = new InMemoryPerformanceRepository({
      generateId: () => 'performance-1',
      now: () => timestamp,
    })

    const created = await repository.save(performanceDraft({ tagIds: ['live', 'live', ' tour '] }))
    expect(created).toMatchObject({
      id: 'performance-1',
      name: '夏日现场',
      tagIds: ['live', 'tour'],
      createdAtMs: 100,
      updatedAtMs: 100,
    })

    timestamp = 200
    const updated = await repository.save({ ...performanceDraft(), id: created.id, name: ' 夏日返场 ' })
    expect(updated).toMatchObject({ name: '夏日返场', createdAtMs: 100, updatedAtMs: 200 })

    const page = await repository.list({ search: '示例艺人', limit: 1 })
    expect(page).toMatchObject({ total: 1, hasMore: false })
    expect(page.items[0].id).toBe(created.id)

    await repository.remove(created.id)
    await expect(repository.get(created.id)).resolves.toBeNull()
    await expect(repository.remove(created.id)).rejects.toBeInstanceOf(DomainNotFoundError)
  })

  it('does not expose mutable references from stored records', async () => {
    const repository = new InMemoryPerformanceRepository({ generateId: () => 'performance-1' })
    const created = await repository.save(performanceDraft())
    created.tagIds.push('mutated')
    created.facets.artist?.push('mutated')

    const stored = await repository.get(created.id) as Performance
    expect(stored.tagIds).toEqual(['live'])
    expect(stored.facets.artist).toEqual(['示例艺人'])
  })

  it('filters derived lifecycle, multiple categories and any selected tag', async () => {
    const referenceTimeMs = 1_800_000_000_000
    const items: Performance[] = [
      performanceItem('past', {
        startedAtMs: referenceTimeMs - 1,
        categoryId: 'concert',
        tagIds: ['live'],
      }),
      performanceItem('future', {
        startedAtMs: referenceTimeMs + 1,
        categoryId: 'festival',
        tagIds: ['tour'],
      }),
      performanceItem('pending', {
        startedAtMs: referenceTimeMs - 100,
        status: PerformanceStatus.PendingSale,
        categoryId: 'concert',
        tagIds: ['sale'],
      }),
      performanceItem('cancelled', {
        startedAtMs: referenceTimeMs + 100,
        status: PerformanceStatus.Cancelled,
        categoryId: 'theatre',
        tagIds: ['tour'],
      }),
    ]
    const repository = new InMemoryPerformanceRepository({ initialItems: items })

    await expect(repository.list({
      lifecycles: ['upcoming', 'pending-sale'],
      referenceTimeMs,
      sortDirection: 'ascending',
    })).resolves.toMatchObject({
      total: 2,
      items: [{ id: 'pending' }, { id: 'future' }],
    })
    await expect(repository.list({
      categoryIds: ['concert', 'festival'],
      tagIdsAny: ['tour', 'sale'],
    })).resolves.toMatchObject({ total: 2 })
    await expect(repository.list({ lifecycles: [], referenceTimeMs })).resolves.toMatchObject({ total: 0 })
  })
})

describe('artist, guest and play manual selection', () => {
  it('adds unique names, edits a selected name and preserves manual order', () => {
    expect(appendSelectedName(['甲乐队'], ' 乙艺人 ')).toEqual(['甲乐队', '乙艺人'])
    expect(appendSelectedName(['甲乐队'], '甲乐队')).toEqual(['甲乐队'])
    expect(replaceSelectedName(['甲乐队', '乙艺人'], 1, ' 丙组合 ')).toEqual(['甲乐队', '丙组合'])
    expect(moveSelectedName(['甲乐队', '乙艺人', '丙组合'], 2, 0)).toEqual(['丙组合', '甲乐队', '乙艺人'])
  })

  it('filters the copied iOS prepared names after custom history names', () => {
    expect(PREPARED_ARTIST_NAMES.length).toBeGreaterThan(6000)
    expect(PREPARED_ARTIST_NAMES[0]).toBe('郑润泽')
    expect(artistNameSuggestions([], 'YoungCaptain')).toContain('队长YoungCaptain')
    expect(artistNameSuggestions(['自定义乐队'], '乐队')[0]).toBe('自定义乐队')
    expect(artistNameSuggestions([], '')).toEqual([])
  })

  it('filters the copied iOS play sources without mixing artist data', () => {
    expect(PREPARED_PLAY_NAMES).toHaveLength(621)
    expect(PREPARED_PLAY_NAMES[0]).toBe('I LOVE YOU…')
    expect(playNameSuggestions([], '阿波罗尼亚')).toContain('阿波罗尼亚')
    expect(playNameSuggestions([], '锁麟囊')).toContain('锁麟囊')
    expect(playNameSuggestions(['自定义剧目'], '剧目')[0]).toBe('自定义剧目')
    expect(playNameSuggestions([], 'YoungCaptain')).toEqual([])
    expect(playNameSuggestions([], '')).toEqual([])
  })
})

describe('purchase channel selection', () => {
  it('uses the iOS preset order and keeps a legacy selected channel available', () => {
    expect(DEFAULT_PURCHASE_CHANNELS.slice(0, 6)).toEqual([
      '大麦', '秀动', '猫眼', '纷玩岛', '摩天轮', '票星球',
    ])
    expect(normalizePurchaseChannels(undefined)).toEqual(DEFAULT_PURCHASE_CHANNELS)
    expect(normalizePurchaseChannels([' 大麦 ', '大麦', '', '自定义渠道'])).toEqual(['大麦', '自定义渠道'])
    expect(purchaseChannelOptions(['大麦', '秀动'], '历史渠道')).toEqual(['历史渠道', '大麦', '秀动'])
    expect(purchaseChannelOptions(['大麦', '秀动'], '大麦')).toEqual(['大麦', '秀动'])
  })
})

describe('friend selection', () => {
  it('starts without presets, normalizes the local friend library, and preserves existing Android values', () => {
    expect(normalizeFriends(undefined)).toEqual([])
    expect(normalizeFriends([' 小林 ', '小林', '', 3, '阿宁'])).toEqual(['小林', '阿宁'])
    expect(friendOptions(['小林', '阿宁'], ['历史好友', '小林'])).toEqual(['历史好友', '小林', '阿宁'])
  })
})

describe('company selection', () => {
  it('uses the copied iOS company source and searches it without mixing other prepared data', () => {
    expect(PREPARED_COMPANY_NAMES).toHaveLength(249)
    expect(PREPARED_COMPANY_NAMES[0]).toBe('aRTS')
    expect(companyNameSuggestions([], '国家大剧院')).toContain('国家大剧院')
    expect(companyNameSuggestions([' 自定义厂牌 '], '自定义')[0]).toBe('自定义厂牌')
    expect(companyNameSuggestions([], '')).toEqual([])
  })

  it('normalizes and persists only custom selected companies', () => {
    expect(normalizeCompanyNames([' aRTS ', 'aRTS', '', 3, '我的厂牌'])).toEqual(['aRTS', '我的厂牌'])
    expect(mergeCustomCompanyNames(['旧厂牌'], ['国家大剧院', '新厂牌', '旧厂牌'])).toEqual(['旧厂牌', '新厂牌'])
  })
})

describe('performance browse preferences', () => {
  it('normalizes persisted values and preserves an explicit empty status filter', () => {
    expect(normalizeBrowsePreferences(null)).toEqual(DEFAULT_BROWSE_PREFERENCES)
    expect(normalizeBrowsePreferences({
      displayMode: 'poster',
      filter: {
        categoryIds: [' concert ', 'concert'],
        tagIds: ['live'],
        year: 2027,
        lifecycles: [],
      },
    })).toEqual({
      displayMode: 'poster',
      posterColumnCount: 4,
      filter: {
        categoryIds: ['concert'],
        tagIds: ['live'],
        year: 2027,
        lifecycles: [],
      },
    })

    expect(normalizeBrowsePreferences({
      displayMode: 'poster',
      posterColumnCount: 8,
    }).posterColumnCount).toBe(8)
    expect(normalizeBrowsePreferences({
      displayMode: 'poster',
      posterColumnCount: 9,
    }).posterColumnCount).toBe(4)
  })

  it('creates an inclusive local-time year range', () => {
    const range = yearRange(2027)
    expect(new Date(range.startedFromMs as number).getFullYear()).toBe(2027)
    expect(new Date(range.startedToMs as number).getFullYear()).toBe(2027)
    expect((range.startedToMs as number) + 1).toBe(new Date(2028, 0, 1).getTime())
    expect(yearRange(null)).toEqual({})
  })
})

class FakeMediaStorage implements PerformanceMediaStorage {
  preparedRoles: PerformanceImageRole[] = []
  removedPaths: string[] = []
  rollbackCount = 0
  removeError = false

  async prepare(role: PerformanceImageRole, selected: SelectedImage): Promise<PreparedImage> {
    this.preparedRoles.push(role)
    const asset: MediaAsset = {
      id: `${role}-asset`,
      kind: role === 'poster' ? 'poster' : 'ticket_original',
      relativePath: `media/${role}.jpg`,
      mimeType: selected.mimeType,
      byteSize: selected.byteSize,
      sha256: 'a'.repeat(64),
      width: null,
      height: null,
      createdAtMs: 100,
    }
    return {
      assets: [asset],
      rollback: async () => { this.rollbackCount += 1 },
    }
  }

  async remove(paths: readonly string[]): Promise<void> {
    this.removedPaths.push(...paths)
    if (this.removeError) throw new Error('media cleanup failure')
  }
}

describe('performance browser service', () => {
  it('removes the record and each unique media path', async () => {
    const repository = new InMemoryPerformanceRepository({ generateId: () => 'performance-1' })
    const created = await repository.save(performanceDraft({
      mediaAssets: [
        {
          id: 'poster-original',
          kind: 'poster',
          relativePath: 'media/poster.jpg',
          mimeType: 'image/jpeg',
          byteSize: 100,
          sha256: 'a'.repeat(64),
          width: null,
          height: null,
          createdAtMs: 1,
        },
        {
          id: 'poster-thumb',
          kind: 'poster_thumb',
          relativePath: 'media/poster.jpg',
          mimeType: 'image/jpeg',
          byteSize: 50,
          sha256: 'b'.repeat(64),
          width: null,
          height: null,
          createdAtMs: 1,
        },
      ],
    }))
    const media = new FakeMediaStorage()
    const browser = new PerformanceBrowserService(repository, media)

    await expect(browser.remove(created.id)).resolves.toEqual({ mediaCleanupFailed: false })
    await expect(repository.get(created.id)).resolves.toBeNull()
    expect(media.removedPaths).toEqual(['media/poster.jpg'])
  })

  it('keeps deletion successful when media cleanup needs a later retry', async () => {
    const repository = new InMemoryPerformanceRepository({ generateId: () => 'performance-1' })
    const created = await repository.save(performanceDraft())
    const media = new FakeMediaStorage()
    media.removeError = true
    const browser = new PerformanceBrowserService(repository, media)

    await expect(browser.remove(created.id)).resolves.toEqual({ mediaCleanupFailed: true })
    await expect(repository.get(created.id)).resolves.toBeNull()
  })

  it('formats list and detail presentation without changing domain records', () => {
    const item: Performance = {
      ...performanceDraft({ startedAtMs: new Date(2027, 4, 6, 19, 30).getTime() }),
      id: 'performance-1',
      createdAtMs: 1,
      updatedAtMs: 1,
    }
    expect(formatPerformanceDate(item.startedAtMs, true)).toMatch(/2027年05月06日 19:30/)
    expect(formatPerformanceCardDate(item.startedAtMs)).toBe('2027-05-06 19:30 周四')
    expect(formatPerformanceLocation(item)).toBe('上海 · 音乐厅')
    expect(performanceLifecycleLabel(item, item.startedAtMs + 1)).toBe('已看')
    expect(performanceMediaPath(item, 'poster')).toBe('')
  })

  it('formats the card countdown with the same hour and calendar-day split as iOS', () => {
    const reference = new Date(2026, 6, 20, 12).getTime()
    expect(relativePerformanceDateText(new Date(2026, 6, 20, 9).getTime(), reference)).toBe('3 h前')
    expect(relativePerformanceDateText(new Date(2026, 6, 20, 17).getTime(), reference)).toBe('5 h后')
    expect(relativePerformanceDateText(new Date(2026, 6, 18, 23).getTime(), reference)).toBe('2 天前')
    expect(relativePerformanceDateText(new Date(2026, 6, 23, 8).getTime(), reference)).toBe('3 天后')
  })
})

describe('performance editor service', () => {
  const selectedImage: SelectedImage = {
    sourcePath: 'temp/poster.jpg',
    previewPath: 'blob:poster',
    byteSize: 1024,
    mimeType: 'image/jpeg',
  }

  it('normalizes delimited fields and validates required location information', () => {
    expect(parseDelimitedValues('A、 B，A;C')).toEqual(['A', 'B', 'C'])
    expect(() => normalizePerformanceDraft(createEmptyPerformanceDraft())).toThrow('请输入演出名称')
    expect(() => normalizePerformanceDraft({
      ...createEmptyPerformanceDraft(),
      name: '演唱会',
    })).toThrow('请选择城市')

    expect(() => normalizePerformanceDraft({
      ...createEmptyPerformanceDraft(),
      name: '演唱会',
      city: '上海',
    })).toThrow('请选择场地')

    expect(normalizePerformanceDraft({
      ...createEmptyPerformanceDraft(),
      name: '  演唱会 ',
      city: ' 上海 ',
      venue: ' 上海文化广场 ',
      ticketPrice: { amount: '0680.5', currency: 'cny' },
    })).toMatchObject({
      name: '演唱会',
      city: '上海',
      venue: '上海文化广场',
      ticketPrice: { amount: '680.5', currency: 'CNY' },
    })
  })

  it('warns about a performance within two hours before preparing media', async () => {
    const repository = new InMemoryPerformanceRepository({
      initialItems: [{
        ...performanceDraft({ startedAtMs: 10_000 }),
        id: 'existing',
        createdAtMs: 1,
        updatedAtMs: 1,
      }],
    })
    const media = new FakeMediaStorage()
    const editor = new PerformanceEditorService(repository, media)

    const result = await editor.save(
      performanceDraft({ startedAtMs: 10_000 + 60 * 60 * 1000 }),
      { poster: selectedImage },
    )

    expect(result.kind).toBe('duplicate')
    expect(media.preparedRoles).toEqual([])
  })

  it('saves prepared media after duplicate confirmation', async () => {
    const repository = new InMemoryPerformanceRepository({ generateId: () => 'performance-1' })
    const media = new FakeMediaStorage()
    const editor = new PerformanceEditorService(repository, media)

    const result = await editor.save(performanceDraft(), { poster: selectedImage }, true)

    expect(result.kind).toBe('saved')
    expect(media.preparedRoles).toEqual(['poster'])
    await expect(repository.get('performance-1')).resolves.toMatchObject({
      mediaAssets: [{ kind: 'poster', relativePath: 'media/poster.jpg' }],
    })
  })

  it('rolls back newly prepared media when the repository save fails', async () => {
    const failingRepository: PerformanceRepository = {
      get: async () => null,
      list: async () => ({ items: [], total: 0, hasMore: false }),
      save: async () => { throw new Error('database failure') },
      remove: async () => undefined,
    }
    const media = new FakeMediaStorage()
    const editor = new PerformanceEditorService(failingRepository, media)

    await expect(
      editor.save(performanceDraft(), { poster: selectedImage }, true),
    ).rejects.toThrow('database failure')
    expect(media.rollbackCount).toBe(1)
  })
})

describe('in-memory reference data repository', () => {
  it('manages categories and tags with stable ordering', async () => {
    const ids = ['category-1', 'category-2', 'tag-1']
    const repository = new InMemoryReferenceDataRepository({
      generateId: () => ids.shift() ?? 'unexpected-id',
      now: () => 100,
    })

    await repository.saveCategory({ name: '音乐节', sortOrder: 2 })
    const first = await repository.saveCategory({ name: '演唱会', sortOrder: 1 })
    const tag = await repository.saveTag({ name: '巡演' })

    await expect(repository.listCategories()).resolves.toMatchObject([
      { name: '演唱会', sortOrder: 1 },
      { name: '音乐节', sortOrder: 2 },
    ])
    await expect(repository.listTags()).resolves.toEqual([tag])

    await repository.removeCategory(first.id)
    await repository.removeTag(tag.id)
    await expect(repository.listCategories()).resolves.toHaveLength(1)
    await expect(repository.listTags()).resolves.toHaveLength(0)
  })

  it('trims names and rejects duplicates ignoring case', async () => {
    const repository = new InMemoryReferenceDataRepository({ generateId: () => 'id-1' })
    await repository.saveTag({ name: '  Live  ' })

    await expect(repository.saveTag({ name: 'live' })).rejects.toBeInstanceOf(DomainConflictError)
    await expect(repository.listTags()).resolves.toMatchObject([{ name: 'Live' }])
  })

  it('updates an existing item without changing its identity or creation time', async () => {
    let timestamp = 100
    const repository = new InMemoryReferenceDataRepository({
      generateId: () => 'category-1',
      now: () => timestamp,
    })
    const created = await repository.saveCategory({ name: '演唱会', sortOrder: 2 })

    timestamp = 200
    const updated = await repository.saveCategory({
      id: created.id,
      name: '音乐现场',
      sortOrder: created.sortOrder,
    })

    expect(updated).toEqual({
      id: 'category-1',
      name: '音乐现场',
      sortOrder: 2,
      createdAtMs: 100,
      updatedAtMs: 200,
    })
  })

  it('reports missing items instead of silently accepting repeated deletion', async () => {
    const repository = new InMemoryReferenceDataRepository()

    await expect(repository.removeCategory('missing')).rejects.toBeInstanceOf(DomainNotFoundError)
    await expect(repository.removeTag('missing')).rejects.toBeInstanceOf(DomainNotFoundError)
  })
})

function performanceItem(
  id: string,
  overrides: Partial<PerformanceDraft> = {},
): Performance {
  return {
    ...performanceDraft(overrides),
    id,
    createdAtMs: 1,
    updatedAtMs: 1,
  }
}
