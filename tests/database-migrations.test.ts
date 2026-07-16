import { describe, expect, it } from 'vitest'

import type { DatabaseDriver, DatabaseRow } from '@/platform/database/driver'
import {
  DATABASE_MIGRATIONS,
  migrateDatabase,
  splitSqlStatements,
  type DatabaseMigration,
} from '@/platform/database/migrations'
import { sqlInteger, sqlText } from '@/platform/database/sql-values'

class FakeDatabaseDriver implements DatabaseDriver {
  isOpen = false
  readonly executed: string[] = []
  readonly appliedVersions = new Set<number>()
  transactionCount = 0
  rollbackCount = 0
  failOn = ''

  async open(): Promise<void> {
    this.isOpen = true
  }

  async close(): Promise<void> {
    this.isOpen = false
  }

  async execute(sql: string | readonly string[]): Promise<void> {
    for (const statement of typeof sql === 'string' ? [sql] : sql) {
      this.executed.push(statement)
      if (this.failOn && statement.includes(this.failOn)) throw new Error('simulated SQL failure')
      const match = statement.match(/INSERT INTO schema_migrations\(version, applied_at_ms\) VALUES \((\d+),/)
      if (match) this.appliedVersions.add(Number(match[1]))
    }
  }

  async query<T extends DatabaseRow>(): Promise<T[]> {
    return [...this.appliedVersions]
      .sort((left, right) => left - right)
      .map((version) => ({ version }) as T)
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.transactionCount += 1
    const snapshot = new Set(this.appliedVersions)
    try {
      return await work()
    } catch (error) {
      this.rollbackCount += 1
      this.appliedVersions.clear()
      for (const version of snapshot) this.appliedVersions.add(version)
      throw error
    }
  }
}

describe('database migrations', () => {
  it('escapes SQL values before repository queries are composed', () => {
    expect(sqlText("O'Brien")).toBe("'O''Brien'")
    expect(sqlInteger(1_800_000_000_000)).toBe('1800000000000')
    expect(() => sqlInteger(1.5)).toThrow('必须是安全整数')
  })

  it('splits SQL while preserving semicolons inside strings and removing line comments', () => {
    expect(
      splitSqlStatements(`
        -- comment with a semicolon;
        INSERT INTO sample(value) VALUES ('live;show');
        INSERT INTO sample(value) VALUES ('it''s fine');
      `),
    ).toEqual([
      "INSERT INTO sample(value) VALUES ('live;show')",
      "INSERT INTO sample(value) VALUES ('it''s fine')",
    ])
  })

  it('builds schema v1 without recording the version inside the schema file', () => {
    const migration = DATABASE_MIGRATIONS[0]
    expect(migration.version).toBe(1)
    expect(migration.statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS performances'))).toBe(true)
    expect(migration.statements.some((sql) => sql.includes('INSERT INTO schema_migrations'))).toBe(false)
  })

  it('applies each pending migration once and records it in the same transaction', async () => {
    const driver = new FakeDatabaseDriver()
    const migrations: DatabaseMigration[] = [
      { version: 1, statements: ['CREATE TABLE first_table(id TEXT)'] },
      { version: 2, statements: ['ALTER TABLE first_table ADD COLUMN name TEXT'] },
    ]

    await expect(migrateDatabase(driver, migrations, () => 1234)).resolves.toEqual([1, 2])
    await expect(migrateDatabase(driver, migrations, () => 5678)).resolves.toEqual([])

    expect(driver.isOpen).toBe(true)
    expect(driver.transactionCount).toBe(2)
    expect(driver.appliedVersions).toEqual(new Set([1, 2]))
    expect(driver.executed).toContain(
      'INSERT INTO schema_migrations(version, applied_at_ms) VALUES (1, 1234)',
    )
  })

  it('rolls back the migration version when a schema statement fails', async () => {
    const driver = new FakeDatabaseDriver()
    driver.failOn = 'BROKEN'

    await expect(
      migrateDatabase(driver, [{ version: 1, statements: ['CREATE TABLE okay(id TEXT)', 'BROKEN SQL'] }]),
    ).rejects.toThrow('simulated SQL failure')

    expect(driver.rollbackCount).toBe(1)
    expect(driver.appliedVersions.size).toBe(0)
  })
})
