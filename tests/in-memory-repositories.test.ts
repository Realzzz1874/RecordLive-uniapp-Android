import { describe, expect, it } from 'vitest'

import { DomainConflictError, DomainNotFoundError } from '@/domain/errors'
import { PerformanceStatus, type Performance } from '@/domain/performance'
import type { PerformanceDraft } from '@/features/performances/repository'
import { InMemoryPerformanceRepository } from '@/platform/repositories/in-memory-performance-repository'
import { InMemoryReferenceDataRepository } from '@/platform/repositories/in-memory-reference-data-repository'

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
})
