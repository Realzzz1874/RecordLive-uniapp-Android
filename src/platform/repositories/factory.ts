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
  backup: BackupUseCases | null
  runtime: 'android-sqlite' | 'h5-memory'
}

export async function createAppRepositories(): Promise<AppRepositories> {
  const driver = createRuntimeDatabaseDriver()
  if (!driver) {
    const performances = new InMemoryPerformanceRepository()
    const referenceData = new InMemoryReferenceDataRepository()
    const settings = new UniStorageAppSettingsRepository()
    return {
      performances,
      referenceData,
      settings,
      backup: null,
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
  let archiveGateway: BackupArchiveGateway | null = null
  // #ifdef APP-PLUS
  archiveGateway = new AndroidBackupArchiveGateway()
  // #endif
  if (!archiveGateway) throw new Error('本地备份仅支持 Android App')
  const backupSnapshot = new SQLiteBackupSnapshotRepository(driver)
  const backup = new BackupUseCases(
    backupSnapshot,
    archiveGateway,
    new UniStorageBackupMetadataRepository(),
    coordinator,
  )
  try {
    await backup.cleanupStaleArtifacts()
  } catch (error) {
    console.error('RecordLive stale backup cleanup will retry on next launch', error)
  }
  return {
    performances: new SQLitePerformanceRepository(driver, {}, coordinator),
    referenceData: new SQLiteReferenceDataRepository(driver, {}, coordinator),
    settings,
    backup,
    runtime: 'android-sqlite',
  }
}
