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
import type { DatabaseDriver, DatabaseRow } from '@/platform/database/driver'
import { sqlInteger, sqlText } from '@/platform/database/sql-values'
import {
  DefaultDataOperationCoordinator,
  type DataOperationCoordinator,
} from '@/platform/backup/data-operation-coordinator'

interface ReferenceRow extends DatabaseRow {
  id: string
  name: string
  sort_order: number
  created_at_ms: number
  updated_at_ms: number
}

interface CountRow extends DatabaseRow {
  count: number
}

interface SQLiteReferenceDataRepositoryOptions {
  generateId?: () => string
  now?: () => number
}

export class SQLiteReferenceDataRepository implements ReferenceDataRepository {
  private readonly generateId: () => string
  private readonly now: () => number

  constructor(
    private readonly driver: DatabaseDriver,
    options: SQLiteReferenceDataRepositoryOptions = {},
    private readonly coordinator: DataOperationCoordinator = new DefaultDataOperationCoordinator(),
  ) {
    this.generateId = options.generateId ?? createId
    this.now = options.now ?? Date.now
  }

  async listCategories(): Promise<PerformanceCategory[]> {
    return this.list('performance_categories')
  }

  async saveCategory(draft: CategoryDraft): Promise<PerformanceCategory> {
    return this.coordinator.withMutation(() =>
      this.save('performance_categories', draft, '分类'))
  }

  async removeCategory(id: string): Promise<void> {
    await this.coordinator.withMutation(() => this.driver.transaction(async () => {
      await this.assertExists('performance_categories', id, '分类')
      const timestamp = this.now()
      await this.driver.execute([
        `UPDATE performances SET category_id = NULL, updated_at_ms = ${sqlInteger(timestamp)} WHERE category_id = ${sqlText(id)} AND deleted_at_ms IS NULL`,
        `UPDATE performance_categories SET deleted_at_ms = ${sqlInteger(timestamp)}, updated_at_ms = ${sqlInteger(timestamp)} WHERE id = ${sqlText(id)}`,
      ])
    }))
  }

  async listTags(): Promise<PerformanceTag[]> {
    return this.list('performance_tags')
  }

  async saveTag(draft: TagDraft): Promise<PerformanceTag> {
    return this.coordinator.withMutation(() =>
      this.save('performance_tags', draft, '标签'))
  }

  async removeTag(id: string): Promise<void> {
    await this.coordinator.withMutation(() => this.driver.transaction(async () => {
      await this.assertExists('performance_tags', id, '标签')
      const timestamp = this.now()
      await this.driver.execute([
        `DELETE FROM performance_tag_links WHERE tag_id = ${sqlText(id)}`,
        `UPDATE performance_tags SET deleted_at_ms = ${sqlInteger(timestamp)}, updated_at_ms = ${sqlInteger(timestamp)} WHERE id = ${sqlText(id)}`,
      ])
    }))
  }

  private async list<T extends PerformanceCategory | PerformanceTag>(table: ReferenceTable): Promise<T[]> {
    const rows = await this.driver.query<ReferenceRow>(
      `SELECT id, name, sort_order, created_at_ms, updated_at_ms FROM ${table} WHERE deleted_at_ms IS NULL ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
    )
    return rows.map(mapReferenceRow) as T[]
  }

  private async save<T extends PerformanceCategory | PerformanceTag>(
    table: ReferenceTable,
    draft: CategoryDraft | TagDraft,
    label: string,
  ): Promise<T> {
    if (draft.id !== undefined && !draft.id.trim()) {
      throw new DomainValidationError(`${label} ID 不能为空`)
    }
    const name = draft.name.trim()
    if (!name) throw new DomainValidationError(`${label}名称不能为空`)
    const duplicateRows = await this.driver.query<CountRow>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE deleted_at_ms IS NULL AND name = ${sqlText(name)} COLLATE NOCASE${draft.id ? ` AND id <> ${sqlText(draft.id)}` : ''}`,
    )
    if (Number(duplicateRows[0]?.count ?? 0) > 0) {
      throw new DomainConflictError(`${label}名称已存在`)
    }

    const existing = draft.id ? await this.get(table, draft.id) : null
    if (draft.id && !existing) throw new DomainNotFoundError(`${label}不存在`)

    const timestamp = this.now()
    const item = {
      id: existing?.id ?? draft.id ?? this.generateId(),
      name,
      sortOrder: normalizeSortOrder(draft.sortOrder ?? existing?.sortOrder ?? await this.nextSortOrder(table)),
      createdAtMs: existing?.createdAtMs ?? timestamp,
      updatedAtMs: timestamp,
    } as T

    await this.driver.execute(`
      INSERT INTO ${table}(id, name, sort_order, created_at_ms, updated_at_ms, deleted_at_ms)
      VALUES (${sqlText(item.id)}, ${sqlText(item.name)}, ${sqlInteger(item.sortOrder)}, ${sqlInteger(item.createdAtMs)}, ${sqlInteger(item.updatedAtMs)}, NULL)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        sort_order = excluded.sort_order,
        updated_at_ms = excluded.updated_at_ms,
        deleted_at_ms = NULL
    `.trim())
    return { ...item }
  }

  private async get<T extends PerformanceCategory | PerformanceTag>(
    table: ReferenceTable,
    id: string,
  ): Promise<T | null> {
    const rows = await this.driver.query<ReferenceRow>(
      `SELECT id, name, sort_order, created_at_ms, updated_at_ms FROM ${table} WHERE id = ${sqlText(id)} AND deleted_at_ms IS NULL LIMIT 1`,
    )
    return rows[0] ? mapReferenceRow(rows[0]) as T : null
  }

  private async nextSortOrder(table: ReferenceTable): Promise<number> {
    const rows = await this.driver.query<CountRow>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE deleted_at_ms IS NULL`,
    )
    return Number(rows[0]?.count ?? 0)
  }

  private async assertExists(table: ReferenceTable, id: string, label: string): Promise<void> {
    if (!await this.get(table, id)) throw new DomainNotFoundError(`${label}不存在`)
  }
}

type ReferenceTable = 'performance_categories' | 'performance_tags'

function mapReferenceRow(row: ReferenceRow): PerformanceCategory {
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    createdAtMs: Number(row.created_at_ms),
    updatedAtMs: Number(row.updated_at_ms),
  }
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
