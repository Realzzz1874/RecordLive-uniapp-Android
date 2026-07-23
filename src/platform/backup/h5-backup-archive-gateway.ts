import {
  validateAndroidBackupData,
  type AndroidBackupDataV1,
  type AndroidBackupManifestV1,
} from '@/domain/backup'
import type {
  RestorePlan,
  RestorePlanContext,
} from '@/domain/backup-restore-plan'
import type {
  BackupArchiveGateway,
  InspectedBackupArchive,
  PreparedBackupArchive,
} from '@/features/backup/repository'

const RECOVERY_KEY = 'recordlive.h5-fake-recovery-v1'
const LAST_ARCHIVE_KEY = 'recordlive.h5-fake-last-archive-v1'

export class H5BackupArchiveGateway implements BackupArchiveGateway {
  readonly runtime = 'h5-fake' as const

  async createArchive(
    data: AndroidBackupDataV1,
    context: RestorePlanContext,
    _mediaSourcePaths: Record<string, string> = {},
  ): Promise<PreparedBackupArchive> {
    const manifest = fakeManifest(data)
    return {
      operationId: context.operationId,
      sandboxPath: `h5-fake://${context.operationId}`,
      suggestedName: backupFileName(manifest.exportedAtMs),
      manifest,
      data: validateAndroidBackupData(data),
    }
  }

  async saveArchiveToUserFile(archive: PreparedBackupArchive): Promise<boolean> {
    uni.setStorageSync(LAST_ARCHIVE_KEY, JSON.stringify(archive))
    return true
  }

  async chooseAndInspectRestoreFile(): Promise<InspectedBackupArchive | null> {
    const raw = uni.getStorageSync(LAST_ARCHIVE_KEY)
    if (typeof raw !== 'string' || !raw) return null
    const archive = JSON.parse(raw) as PreparedBackupArchive
    return {
      selected: {
        uri: archive.sandboxPath,
        displayName: archive.suggestedName,
        byteSize: null,
      },
      sandboxPath: archive.sandboxPath,
      manifest: archive.manifest,
      data: validateAndroidBackupData(archive.data),
    }
  }

  async stageMedia(
    _archive: InspectedBackupArchive,
    plan: RestorePlan,
  ): Promise<Record<string, string>> {
    return Object.fromEntries(plan.mediaSources
      .filter((source) => source.source === 'backup')
      .map(({ assetId }) => [assetId, `h5-fake://restored/${assetId}.jpg`]))
  }

  async createRecoveryPoint(
    data: AndroidBackupDataV1,
    context: RestorePlanContext,
  ): Promise<void> {
    const archive = await this.createArchive(data, context, {})
    uni.setStorageSync(RECOVERY_KEY, JSON.stringify(archive))
  }

  async inspectRecoveryPoint(): Promise<InspectedBackupArchive | null> {
    const raw = uni.getStorageSync(RECOVERY_KEY)
    if (typeof raw !== 'string' || !raw) return null
    const archive = JSON.parse(raw) as PreparedBackupArchive
    return {
      selected: {
        uri: archive.sandboxPath,
        displayName: '撤销上次恢复',
        byteSize: null,
      },
      sandboxPath: archive.sandboxPath,
      manifest: archive.manifest,
      data: validateAndroidBackupData(archive.data),
    }
  }

  async deleteRecoveryPoint(): Promise<void> {
    uni.removeStorageSync(RECOVERY_KEY)
  }

  async hasRecoveryPoint(): Promise<boolean> {
    return Boolean(uni.getStorageSync(RECOVERY_KEY))
  }

  async cleanup(): Promise<void> {}
}

function fakeManifest(data: AndroidBackupDataV1): AndroidBackupManifestV1 {
  const exportedAtMs = Date.now()
  return {
    schemaVersion: 1,
    backupKind: 'android-local',
    appVersion: '0.1.0',
    exportedAtMs,
    dataFile: 'data.json',
    files: [{
      path: 'data.json',
      byteSize: new TextEncoder().encode(JSON.stringify(data)).byteLength,
      sha256: '0'.repeat(64),
    }],
  }
}

function backupFileName(timestamp: number): string {
  const date = new Date(timestamp)
  const part = (value: number) => String(value).padStart(2, '0')
  return `RecordLive-Android-${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}.backup.zip`
}
