import type { DatabaseDriver } from './driver'
import { PlusSQLiteDriver } from './plus-sqlite-driver'

export function createRuntimeDatabaseDriver(): DatabaseDriver | null {
  // #ifdef APP-PLUS
  return new PlusSQLiteDriver()
  // #endif

  // #ifndef APP-PLUS
  return null
  // #endif
}
