import {
  BACKUP_SETTING_KEYS,
  type BackupSettingKey,
} from '@/domain/backup'
import { normalizeBackupSettingValue } from '@/domain/backup-settings'
import type { AppSettingsRepository } from '@/features/preferences/repository'

const MIGRATION_MARKER = 'recordlive.local-settings-migrated-v1'

export async function migrateLegacyLocalSettings(
  repository: AppSettingsRepository,
): Promise<void> {
  if (uni.getStorageSync(MIGRATION_MARKER) === true) return
  for (const key of BACKUP_SETTING_KEYS.slice(4)) {
    await migrateKey(repository, key)
  }
  uni.setStorageSync(MIGRATION_MARKER, true)
}

async function migrateKey(
  repository: AppSettingsRepository,
  key: BackupSettingKey,
): Promise<void> {
  const stored = hasStoredReader(repository)
    ? await repository.getStored<unknown>(key)
    : await repository.get<unknown>(key)
  if (stored !== null) return
  const legacy = uni.getStorageSync(key)
  if (legacy === '' || legacy === null || legacy === undefined) return
  const normalized = normalizeBackupSettingValue(key, legacy)
  await repository.set(key, normalized)
  const confirmed = await repository.get<unknown>(key)
  if (JSON.stringify(confirmed) !== JSON.stringify(normalized)) {
    throw new Error(`设置迁移回读失败：${key}`)
  }
}

function hasStoredReader(
  repository: AppSettingsRepository,
): repository is AppSettingsRepository & {
  getStored<T>(key: string): Promise<T | null>
} {
  return 'getStored' in repository && typeof repository.getStored === 'function'
}
