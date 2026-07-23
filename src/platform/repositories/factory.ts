import type { PerformanceRepository } from '@/features/performances/repository'
import type { ReferenceDataRepository } from '@/features/reference-data/repository'
import type { AppSettingsRepository } from '@/features/preferences/repository'
import { createRuntimeDatabaseDriver } from '@/platform/database/factory'
import { migrateDatabase } from '@/platform/database/migrations'
import { InMemoryPerformanceRepository } from './in-memory-performance-repository'
import { InMemoryReferenceDataRepository } from './in-memory-reference-data-repository'
import { SQLitePerformanceRepository } from './sqlite-performance-repository'
import { SQLiteReferenceDataRepository } from './sqlite-reference-data-repository'
import { SQLiteAppSettingsRepository } from './sqlite-app-settings-repository'
import { UniStorageAppSettingsRepository } from './uni-storage-app-settings-repository'
import { BackupUseCases } from '@/features/backup/use-cases'
import type { BackupArchiveGateway } from '@/features/backup/repository'
import { DefaultDataOperationCoordinator } from '@/platform/backup/data-operation-coordinator'
import { H5BackupArchiveGateway } from '@/platform/backup/h5-backup-archive-gateway'
import { H5BackupSnapshotRepository } from '@/platform/backup/h5-backup-snapshot-repository'
import { migrateLegacyLocalSettings } from '@/platform/backup/migrate-local-settings'
import { SQLiteBackupSnapshotRepository } from '@/platform/backup/sqlite-backup-snapshot-repository'
import { UniStorageBackupMetadataRepository } from '@/platform/backup/uni-storage-backup-metadata-repository'
// #ifdef APP-PLUS
import { AndroidBackupArchiveGateway } from '@/platform/backup/android-backup-archive-gateway'
// #endif

export interface AppRepositories {
  performances: PerformanceRepository
  referenceData: ReferenceDataRepository
  settings: AppSettingsRepository
  backup: BackupUseCases
  runtime: 'android-sqlite' | 'h5-memory'
}

export async function createAppRepositories(): Promise<AppRepositories> {
  const driver = createRuntimeDatabaseDriver()
  if (!driver) {
    const performances = new InMemoryPerformanceRepository()
    const referenceData = new InMemoryReferenceDataRepository()
    const settings = new UniStorageAppSettingsRepository()
    const coordinator = new DefaultDataOperationCoordinator()
    return {
      performances,
      referenceData,
      settings,
      backup: new BackupUseCases(
        new H5BackupSnapshotRepository(performances, referenceData, settings),
        new H5BackupArchiveGateway(),
        new UniStorageBackupMetadataRepository(),
        coordinator,
      ),
      runtime: 'h5-memory',
    }
  }

  await migrateDatabase(driver)
  const coordinator = new DefaultDataOperationCoordinator()
  const settings = new SQLiteAppSettingsRepository(driver, Date.now, coordinator)
  try {
    await migrateLegacyLocalSettings(settings)
  } catch (error) {
    console.error('RecordLive local settings migration will retry on next launch', error)
  }
  let archiveGateway: BackupArchiveGateway
  // #ifdef APP-PLUS
  archiveGateway = new AndroidBackupArchiveGateway()
  // #endif
  // #ifndef APP-PLUS
  archiveGateway = new H5BackupArchiveGateway()
  // #endif
  return {
    performances: new SQLitePerformanceRepository(driver, {}, coordinator),
    referenceData: new SQLiteReferenceDataRepository(driver, {}, coordinator),
    settings,
    backup: new BackupUseCases(
      new SQLiteBackupSnapshotRepository(driver),
      archiveGateway,
      new UniStorageBackupMetadataRepository(),
      coordinator,
    ),
    runtime: 'android-sqlite',
  }
}
