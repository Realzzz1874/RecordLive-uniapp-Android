import type { BackupMetadataRepository } from '@/features/backup/repository'

const LAST_BACKUP_KEY = 'recordlive.backup.last-success-at-ms'

export class UniStorageBackupMetadataRepository implements BackupMetadataRepository {
  async getLastBackupAtMs(): Promise<number | null> {
    const value = Number(uni.getStorageSync(LAST_BACKUP_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }

  async setLastBackupAtMs(value: number): Promise<void> {
    uni.setStorageSync(LAST_BACKUP_KEY, value)
  }
}
