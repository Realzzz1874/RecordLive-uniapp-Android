export type DatabaseRow = Record<string, unknown>

export interface DatabaseDriver {
  readonly isOpen: boolean
  open(): Promise<void>
  close(): Promise<void>
  execute(sql: string | readonly string[]): Promise<void>
  query<T extends DatabaseRow>(sql: string): Promise<T[]>
  transaction<T>(work: () => Promise<T>): Promise<T>
}

export class DatabaseUnavailableError extends Error {
  constructor(message = 'SQLite is only available in the Android App runtime') {
    super(message)
    this.name = 'DatabaseUnavailableError'
  }
}
