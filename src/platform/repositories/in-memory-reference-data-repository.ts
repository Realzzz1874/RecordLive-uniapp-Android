import {
  DomainConflictError,
  DomainNotFoundError,
  DomainValidationError,
} from '@/domain/errors'
import type {
  CategoryDraft,
  PerformanceCategory,
  PerformanceTag,
  TagDraft,
} from '@/domain/reference-data'
import type { ReferenceDataRepository } from '@/features/reference-data/repository'

interface InMemoryReferenceDataRepositoryOptions {
  categories?: readonly PerformanceCategory[]
  tags?: readonly PerformanceTag[]
  generateId?: () => string
  now?: () => number
}

export class InMemoryReferenceDataRepository implements ReferenceDataRepository {
  private readonly categories = new Map<string, PerformanceCategory>()
  private readonly tags = new Map<string, PerformanceTag>()
  private readonly generateId: () => string
  private readonly now: () => number

  constructor(options: InMemoryReferenceDataRepositoryOptions = {}) {
    this.generateId = options.generateId ?? createId
    this.now = options.now ?? Date.now
    for (const item of options.categories ?? []) this.categories.set(item.id, { ...item })
    for (const item of options.tags ?? []) this.tags.set(item.id, { ...item })
  }

  async listCategories(): Promise<PerformanceCategory[]> {
    return sorted(this.categories.values())
  }

  async saveCategory(draft: CategoryDraft): Promise<PerformanceCategory> {
    return this.saveItem(this.categories, draft, '分类')
  }

  async removeCategory(id: string): Promise<void> {
    this.removeItem(this.categories, id, '分类')
  }

  async listTags(): Promise<PerformanceTag[]> {
    return sorted(this.tags.values())
  }

  async saveTag(draft: TagDraft): Promise<PerformanceTag> {
    return this.saveItem(this.tags, draft, '标签')
  }

  async removeTag(id: string): Promise<void> {
    this.removeItem(this.tags, id, '标签')
  }

  private saveItem<T extends PerformanceCategory | PerformanceTag>(
    collection: Map<string, T>,
    draft: CategoryDraft | TagDraft,
    label: string,
  ): T {
    if (draft.id !== undefined && !draft.id.trim()) {
      throw new DomainValidationError(`${label} ID 不能为空`)
    }
    const name = draft.name.trim()
    if (!name) throw new DomainValidationError(`${label}名称不能为空`)
    const duplicate = [...collection.values()].find(
      (item) => item.id !== draft.id && item.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (duplicate) throw new DomainConflictError(`${label}名称已存在`)

    const existing = draft.id ? collection.get(draft.id) : undefined
    if (draft.id && !existing) throw new DomainNotFoundError(`${label}不存在`)
    const timestamp = this.now()
    const item = {
      id: existing?.id ?? draft.id ?? this.generateId(),
      name,
      sortOrder: normalizeSortOrder(draft.sortOrder ?? existing?.sortOrder ?? collection.size),
      createdAtMs: existing?.createdAtMs ?? timestamp,
      updatedAtMs: timestamp,
    } as T
    collection.set(item.id, item)
    return { ...item }
  }

  private removeItem<T>(collection: Map<string, T>, id: string, label: string): void {
    if (!collection.delete(id)) throw new DomainNotFoundError(`${label}不存在`)
  }
}

function sorted<T extends PerformanceCategory | PerformanceTag>(items: Iterable<T>): T[] {
  return [...items]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((item) => ({ ...item }))
}

function normalizeSortOrder(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError('排序值必须是非负整数')
  }
  return value
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
