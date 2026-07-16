import type { DatabaseDriver, DatabaseRow } from './driver'

const DATABASE_NAME = 'recordlive'
const DATABASE_PATH = '_doc/recordlive/recordlive.db'

export class PlusSQLiteDriver implements DatabaseDriver {
  get isOpen(): boolean {
    return plus.sqlite.isOpenDatabase({ name: DATABASE_NAME, path: DATABASE_PATH })
  }

  async open(): Promise<void> {
    if (this.isOpen) return
    await ensureRecordLiveDirectory()

    await new Promise<void>((resolve, reject) => {
      plus.sqlite.openDatabase({
        name: DATABASE_NAME,
        path: DATABASE_PATH,
        success: () => resolve(),
        fail: (error) => reject(toDatabaseError('open database', error)),
      })
    })
  }

  async close(): Promise<void> {
    if (!this.isOpen) return
    await new Promise<void>((resolve, reject) => {
      plus.sqlite.closeDatabase({
        name: DATABASE_NAME,
        success: () => resolve(),
        fail: (error) => reject(toDatabaseError('close database', error)),
      })
    })
  }

  async execute(sql: string | readonly string[]): Promise<void> {
    const statements = typeof sql === 'string' ? [sql] : [...sql]
    if (statements.length === 0) return

    await new Promise<void>((resolve, reject) => {
      plus.sqlite.executeSql({
        name: DATABASE_NAME,
        sql: statements,
        success: () => resolve(),
        fail: (error) => reject(toDatabaseError('execute SQL', error)),
      })
    })
  }

  async query<T extends DatabaseRow>(sql: string): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      plus.sqlite.selectSql({
        name: DATABASE_NAME,
        sql,
        success: (rows) => resolve(rows as T[]),
        fail: (error) => reject(toDatabaseError('query SQL', error)),
      })
    })
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    await this.changeTransaction('begin')
    try {
      const result = await work()
      await this.changeTransaction('commit')
      return result
    } catch (error) {
      try {
        await this.changeTransaction('rollback')
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Database transaction and rollback failed')
      }
      throw error
    }
  }

  private async changeTransaction(operation: 'begin' | 'commit' | 'rollback'): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      plus.sqlite.transaction({
        name: DATABASE_NAME,
        operation,
        success: () => resolve(),
        fail: (error) => reject(toDatabaseError(`${operation} transaction`, error)),
      })
    })
  }
}

async function ensureRecordLiveDirectory(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      '_doc/',
      (root) => {
        root.getDirectory(
          'recordlive',
          { create: true },
          () => resolve(),
          (error) => reject(toDatabaseError('create database directory', error)),
        )
      },
      (error) => reject(toDatabaseError('resolve app document directory', error)),
    )
  })
}

function toDatabaseError(operation: string, value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return new Error(`Failed to ${operation}: ${String(value.message)}`)
  }
  return new Error(`Failed to ${operation}`)
}
