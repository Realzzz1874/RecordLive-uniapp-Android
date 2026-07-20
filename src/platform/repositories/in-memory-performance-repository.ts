import {
  DomainNotFoundError,
  DomainValidationError,
} from '@/domain/errors'
import { derivePerformanceLifecycle, type Performance } from '@/domain/performance'
import type {
  PerformanceDraft,
  PerformancePage,
  PerformanceQuery,
  PerformanceRepository,
} from '@/features/performances/repository'

interface InMemoryPerformanceRepositoryOptions {
  initialItems?: readonly Performance[]
  generateId?: () => string
  now?: () => number
}

export class InMemoryPerformanceRepository implements PerformanceRepository {
  private readonly items = new Map<string, Performance>()
  private readonly generateId: () => string
  private readonly now: () => number

  constructor(options: InMemoryPerformanceRepositoryOptions = {}) {
    this.generateId = options.generateId ?? createId
    this.now = options.now ?? Date.now
    for (const item of options.initialItems ?? []) this.items.set(item.id, clonePerformance(item))
  }

  async get(id: string): Promise<Performance | null> {
    const item = this.items.get(id)
    return item ? clonePerformance(item) : null
  }

  async list(query: PerformanceQuery = {}): Promise<PerformancePage> {
    const search = query.search?.trim().toLocaleLowerCase()
    const requiredTags = new Set(query.tagIds ?? [])
    const anyTags = query.tagIdsAny === undefined ? null : new Set(query.tagIdsAny)
    const statuses = query.statuses ? new Set(query.statuses) : null
    const categories = query.categoryIds === undefined ? null : new Set(query.categoryIds)
    const lifecycles = query.lifecycles === undefined ? null : new Set(query.lifecycles)
    const referenceTimeMs = query.referenceTimeMs ?? Date.now()

    const matched = [...this.items.values()]
      .filter((item) => {
        if (search && !matchesSearch(item, search)) return false
        if (query.categoryId && item.categoryId !== query.categoryId) return false
        if (categories && (!item.categoryId || !categories.has(item.categoryId))) return false
        if (statuses && !statuses.has(item.status)) return false
        if (lifecycles && !lifecycles.has(derivePerformanceLifecycle(item, referenceTimeMs))) return false
        if (query.startedFromMs !== undefined && item.startedAtMs < query.startedFromMs) return false
        if (query.startedToMs !== undefined && item.startedAtMs > query.startedToMs) return false
        if ([...requiredTags].some((tagId) => !item.tagIds.includes(tagId))) return false
        if (anyTags && !item.tagIds.some((tagId) => anyTags.has(tagId))) return false
        return true
      })
      .sort((left, right) => {
        const direction = query.sortDirection === 'ascending' ? 1 : -1
        return (left.startedAtMs - right.startedAtMs || left.id.localeCompare(right.id)) * direction
      })

    const offset = normalizeNonNegativeInteger(query.offset, 0, 'offset')
    const limit = normalizeNonNegativeInteger(query.limit, 50, 'limit')
    const items = matched.slice(offset, offset + limit).map(clonePerformance)

    return {
      items,
      total: matched.length,
      hasMore: offset + items.length < matched.length,
    }
  }

  async save(draft: PerformanceDraft): Promise<Performance> {
    if (draft.id !== undefined && !draft.id.trim()) {
      throw new DomainValidationError('演出 ID 不能为空')
    }
    const name = draft.name.trim()
    if (!name) throw new DomainValidationError('演出名称不能为空')
    if (!Number.isSafeInteger(draft.startedAtMs) || draft.startedAtMs < 0) {
      throw new DomainValidationError('演出时间无效')
    }
    if (!Number.isFinite(draft.rating) || draft.rating < 0 || draft.rating > 5) {
      throw new DomainValidationError('评分必须在 0 到 5 之间')
    }

    const existing = draft.id ? this.items.get(draft.id) : undefined
    if (draft.id && !existing) throw new DomainNotFoundError('演出记录不存在')

    const timestamp = this.now()
    const item: Performance = {
      ...clonePerformanceDraft(draft),
      id: existing?.id ?? draft.id ?? this.generateId(),
      name,
      tagIds: uniqueStrings(draft.tagIds),
      facets: cloneFacets(draft.facets),
      createdAtMs: existing?.createdAtMs ?? timestamp,
      updatedAtMs: timestamp,
    }
    this.items.set(item.id, item)
    return clonePerformance(item)
  }

  async remove(id: string): Promise<void> {
    if (!this.items.delete(id)) throw new DomainNotFoundError('演出记录不存在')
  }
}

function matchesSearch(item: Performance, search: string): boolean {
  const facetValues = Object.values(item.facets).flatMap((values) => values ?? [])
  return [item.name, item.city, item.venue, item.remark, item.seat, ...facetValues]
    .some((value) => value.toLocaleLowerCase().includes(search))
}

function clonePerformanceDraft(draft: PerformanceDraft): PerformanceDraft {
  return {
    ...draft,
    ticketPrice: { ...draft.ticketPrice },
    paidPrice: { ...draft.paidPrice },
    otherCost: { ...draft.otherCost },
    coordinate: draft.coordinate ? { ...draft.coordinate } : null,
    tagIds: [...draft.tagIds],
    facets: cloneFacets(draft.facets),
    mediaAssets: draft.mediaAssets.map((asset) => ({ ...asset })),
  }
}

function clonePerformance(item: Performance): Performance {
  return {
    ...item,
    ticketPrice: { ...item.ticketPrice },
    paidPrice: { ...item.paidPrice },
    otherCost: { ...item.otherCost },
    coordinate: item.coordinate ? { ...item.coordinate } : null,
    tagIds: [...item.tagIds],
    facets: cloneFacets(item.facets),
    mediaAssets: item.mediaAssets.map((asset) => ({ ...asset })),
  }
}

function cloneFacets(
  facets: Performance['facets'],
): Performance['facets'] {
  return Object.fromEntries(
    Object.entries(facets).map(([kind, values]) => [kind, values ? [...values] : values]),
  ) as Performance['facets']
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new DomainValidationError(`${label} 必须是非负整数`)
  }
  return resolved
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
