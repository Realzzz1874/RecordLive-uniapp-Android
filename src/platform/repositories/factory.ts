import type { PerformanceRepository } from '@/features/performances/repository'
import type { ReferenceDataRepository } from '@/features/reference-data/repository'
import { createRuntimeDatabaseDriver } from '@/platform/database/factory'
import { migrateDatabase } from '@/platform/database/migrations'
import { InMemoryPerformanceRepository } from './in-memory-performance-repository'
import { InMemoryReferenceDataRepository } from './in-memory-reference-data-repository'
import { SQLitePerformanceRepository } from './sqlite-performance-repository'
import { SQLiteReferenceDataRepository } from './sqlite-reference-data-repository'

export interface AppRepositories {
  performances: PerformanceRepository
  referenceData: ReferenceDataRepository
  runtime: 'android-sqlite' | 'h5-memory'
}

export async function createAppRepositories(): Promise<AppRepositories> {
  const driver = createRuntimeDatabaseDriver()
  if (!driver) {
    return {
      performances: new InMemoryPerformanceRepository(),
      referenceData: new InMemoryReferenceDataRepository(),
      runtime: 'h5-memory',
    }
  }

  await migrateDatabase(driver)
  return {
    performances: new SQLitePerformanceRepository(driver),
    referenceData: new SQLiteReferenceDataRepository(driver),
    runtime: 'android-sqlite',
  }
}
