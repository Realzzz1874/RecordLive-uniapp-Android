import type { AndroidBackupDataV1, AndroidBackupManifestV1 } from '@/domain/backup'
import type {
  CurrentRestoreState,
  RestorePlan,
  RestorePlanContext,
} from '@/domain/backup-restore-plan'

export interface BackupSummary {
  performanceCount: number
  mediaCount: number
  mediaBytes: number
  lastBackupAtMs: number | null
  hasRecoveryPoint: boolean
}

export interface BackupSnapshotRepository {
  exportSnapshot(): Promise<AndroidBackupDataV1>
  loadRestoreState(): Promise<CurrentRestoreState>
  applyRestorePlan(plan: RestorePlan, stagedMediaPaths: Record<string, string>): Promise<void>
}

export interface PreparedBackupArchive {
  operationId: string
  sandboxPath: string
  suggestedName: string
  manifest: AndroidBackupManifestV1
  data: AndroidBackupDataV1
}

export interface SelectedBackupFile {
  uri: string
  displayName: string
  byteSize: number | null
}

export interface InspectedBackupArchive {
  selected: SelectedBackupFile
  sandboxPath: string
  manifest: AndroidBackupManifestV1
  data: AndroidBackupDataV1
}

export interface BackupArchiveGateway {
  createArchive(
    data: AndroidBackupDataV1,
    context: RestorePlanContext,
    mediaSourcePaths: Record<string, string>,
  ): Promise<PreparedBackupArchive>
  saveArchiveToUserFile(archive: PreparedBackupArchive): Promise<boolean>
  chooseAndInspectRestoreFile(): Promise<InspectedBackupArchive | null>
  stageMedia(
    archive: InspectedBackupArchive,
    plan: RestorePlan,
  ): Promise<Record<string, string>>
  createRecoveryPoint(
    data: AndroidBackupDataV1,
    context: RestorePlanContext,
    mediaSourcePaths: Record<string, string>,
  ): Promise<void>
  inspectRecoveryPoint(): Promise<InspectedBackupArchive | null>
  deleteRecoveryPoint(): Promise<void>
  hasRecoveryPoint(): Promise<boolean>
  cleanup(archive?: PreparedBackupArchive | InspectedBackupArchive): Promise<void>
}

export interface BackupMetadataRepository {
  getLastBackupAtMs(): Promise<number | null>
  setLastBackupAtMs(value: number): Promise<void>
}
