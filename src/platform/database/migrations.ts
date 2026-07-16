import schemaV1Sql from '../../../database/schema-v1.sql?raw'

import type { DatabaseDriver, DatabaseRow } from './driver'

export interface DatabaseMigration {
  version: number
  statements: readonly string[]
}

interface MigrationVersionRow extends DatabaseRow {
  version: number
}

const CREATE_MIGRATION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at_ms INTEGER NOT NULL
)
`.trim()

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    statements: splitSqlStatements(schemaV1Sql).filter(
      (statement) => !/CREATE TABLE IF NOT EXISTS schema_migrations/i.test(statement),
    ),
  },
] as const

export async function migrateDatabase(
  driver: DatabaseDriver,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS,
  now: () => number = Date.now,
): Promise<number[]> {
  if (!driver.isOpen) await driver.open()

  await driver.execute('PRAGMA foreign_keys = ON')
  await driver.execute(CREATE_MIGRATION_TABLE)

  const appliedRows = await driver.query<MigrationVersionRow>(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
  )
  const appliedVersions = new Set(appliedRows.map(({ version }) => Number(version)))
  const pending = [...migrations]
    .sort((left, right) => left.version - right.version)
    .filter(({ version }) => !appliedVersions.has(version))

  const newlyApplied: number[] = []
  for (const migration of pending) {
    assertValidMigration(migration)
    await driver.transaction(async () => {
      if (migration.statements.length > 0) await driver.execute(migration.statements)
      await driver.execute(
        `INSERT INTO schema_migrations(version, applied_at_ms) VALUES (${migration.version}, ${now()})`,
      )
    })
    newlyApplied.push(migration.version)
  }

  return newlyApplied
}

export function splitSqlStatements(source: string): string[] {
  const statements: string[] = []
  let current = ''
  let quote: "'" | '"' | null = null
  let inLineComment = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (inLineComment) {
      if (character === '\n') {
        inLineComment = false
        current += character
      }
      continue
    }

    if (!quote && character === '-' && next === '-') {
      inLineComment = true
      index += 1
      continue
    }

    if (quote) {
      current += character
      if (character === quote) {
        if (next === quote) {
          current += next
          index += 1
        } else {
          quote = null
        }
      }
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
      current += character
      continue
    }

    if (character === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      continue
    }

    current += character
  }

  const trailing = current.trim()
  if (trailing) statements.push(trailing)
  if (quote) throw new Error('Unterminated SQL string literal')
  return statements
}

function assertValidMigration(migration: DatabaseMigration): void {
  if (!Number.isSafeInteger(migration.version) || migration.version <= 0) {
    throw new Error(`Invalid database migration version: ${migration.version}`)
  }
}
