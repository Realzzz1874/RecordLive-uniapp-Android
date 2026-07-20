import { describe, expect, it } from 'vitest'

import type { DatabaseDriver, DatabaseRow } from '@/platform/database/driver'
import { SQLiteAppSettingsRepository } from '@/platform/repositories/sqlite-app-settings-repository'
import { SQLitePerformanceRepository } from '@/platform/repositories/sqlite-performance-repository'

class QueryRecordingDriver implements DatabaseDriver {
  isOpen = true
  queries: string[] = []
  statements: string[] = []
  settingValue: string | null = null

  async open(): Promise<void> {}
  async close(): Promise<void> {}

  async execute(sql: string | readonly string[]): Promise<void> {
    this.statements.push(...(typeof sql === 'string' ? [sql] : sql))
  }

  async query<T extends DatabaseRow>(sql: string): Promise<T[]> {
    this.queries.push(sql)
    if (sql.includes('FROM app_settings')) {
      return this.settingValue === null ? [] : [{ value_json: this.settingValue } as T]
    }
    if (sql.includes('COUNT(*)')) return [{ count: 0 } as T]
    return []
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    return work()
  }
}

describe('Milestone 3 SQLite query composition', () => {
  it('composes lifecycle, multi-category and any-tag filters in SQLite', async () => {
    const driver = new QueryRecordingDriver()
    const repository = new SQLitePerformanceRepository(driver)

    await repository.list({
      lifecycles: ['upcoming', 'pending-sale'],
      referenceTimeMs: 1_800_000_000_000,
      categoryIds: ['concert', 'festival'],
      tagIdsAny: ['live', 'tour'],
    })

    const sql = driver.queries.join('\n')
    expect(sql).toContain('(p.status = 0 AND p.started_at_ms >= 1800000000000)')
    expect(sql).toContain('p.status = 2')
    expect(sql).toContain("p.category_id IN ('concert', 'festival')")
    expect(sql).toContain("tl.tag_id IN ('live', 'tour')")
  })

  it('turns an explicit empty lifecycle selection into no results', async () => {
    const driver = new QueryRecordingDriver()
    const repository = new SQLitePerformanceRepository(driver)

    await repository.list({ lifecycles: [], referenceTimeMs: 1_800_000_000_000 })

    expect(driver.queries[0]).toContain('0 = 1')
  })
})

describe('Milestone 3 app settings persistence', () => {
  it('reads JSON settings and writes an SQLite upsert', async () => {
    const driver = new QueryRecordingDriver()
    driver.settingValue = JSON.stringify({ displayMode: 'poster' })
    const repository = new SQLiteAppSettingsRepository(driver, () => 1234)

    await expect(repository.get('browse')).resolves.toEqual({ displayMode: 'poster' })
    await repository.set('browse', { displayMode: 'card' })

    expect(driver.statements[0]).toContain("VALUES ('browse', '{\"displayMode\":\"card\"}', 1234)")
    expect(driver.statements[0]).toContain('ON CONFLICT(key) DO UPDATE SET')
  })

  it('ignores corrupted settings instead of blocking app startup', async () => {
    const driver = new QueryRecordingDriver()
    driver.settingValue = '{broken'
    const repository = new SQLiteAppSettingsRepository(driver)

    await expect(repository.get('browse')).resolves.toBeNull()
  })
})
