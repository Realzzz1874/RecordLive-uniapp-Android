import { planRestore, type RestoreMode, type RestorePlan } from '@/domain/backup-restore-plan'
import type {
  BackupArchiveGateway,
  BackupMetadataRepository,
  BackupSnapshotRepository,
  BackupSummary,
  InspectedBackupArchive,
} from './repository'
import type { DataOperationCoordinator } from '@/platform/backup/data-operation-coordinator'

export interface RestorePreview {
  archive: InspectedBackupArchive
  operationId: string
  appliedAtMs: number
  replacePlan: RestorePlan
  mergePlan: RestorePlan
  source: 'file' | 'recovery'
}

export interface RestoreResult {
  plan: RestorePlan
}

export class BackupUseCases {
  constructor(
    private readonly snapshot: BackupSnapshotRepository,
    private readonly archive: BackupArchiveGateway,
    private readonly metadata: BackupMetadataRepository,
    private readonly coordinator: DataOperationCoordinator,
    private readonly now: () => number = Date.now,
    private readonly generateId: () => string = createOperationId,
  ) {}

  async getSummary(): Promise<BackupSummary> {
    const [data, lastBackupAtMs, hasRecoveryPoint] = await Promise.all([
      this.snapshot.exportSnapshot(),
      this.metadata.getLastBackupAtMs(),
      this.archive.hasRecoveryPoint(),
    ])
    return {
      performanceCount: data.performances.length,
      mediaCount: data.mediaAssets.length,
      mediaBytes: data.mediaAssets.reduce((sum, { byteSize }) => sum + byteSize, 0),
      lastBackupAtMs,
      hasRecoveryPoint,
    }
  }

  async createBackup(): Promise<'saved' | 'cancelled'> {
    return this.coordinator.withExclusiveDataAccess(async () => {
      const state = await this.snapshot.loadRestoreState()
      const context = { operationId: this.generateId(), appliedAtMs: this.now() }
      const prepared = await this.archive.createArchive(
        state.data,
        context,
        state.mediaRelativePaths,
      )
      try {
        const saved = await this.archive.saveArchiveToUserFile(prepared)
        if (!saved) return 'cancelled'
        await this.metadata.setLastBackupAtMs(this.now())
        return 'saved'
      } finally {
        await this.archive.cleanup(prepared)
      }
    })
  }

  async inspectRestoreFile(): Promise<RestorePreview | null> {
    const inspected = await this.archive.chooseAndInspectRestoreFile()
    return inspected ? this.preview(inspected, 'file') : null
  }

  async inspectRecoveryPoint(): Promise<RestorePreview | null> {
    const inspected = await this.archive.inspectRecoveryPoint()
    return inspected ? this.preview(inspected, 'recovery') : null
  }

  async restore(preview: RestorePreview, mode: RestoreMode): Promise<RestoreResult> {
    return this.coordinator.withExclusiveDataAccess(async () => {
      const current = await this.snapshot.loadRestoreState()
      const context = {
        operationId: preview.operationId,
        appliedAtMs: preview.appliedAtMs,
      }
      const plan = planRestore(current, preview.archive.data, mode, context)
      const previewPlan = mode === 'replace-all' ? preview.replacePlan : preview.mergePlan
      if (plan.planFingerprint !== previewPlan.planFingerprint) {
        throw new Error('恢复期间本机数据已发生变化，请重新预览并确认')
      }

      const recoveryContext = {
        operationId: `${this.generateId()}-recovery`,
        appliedAtMs: this.now(),
      }
      await this.archive.createRecoveryPoint(
        current.data,
        recoveryContext,
        current.mediaRelativePaths,
      )
      const stagedMedia = await this.archive.stageMedia(preview.archive, plan)
      await this.snapshot.applyRestorePlan(plan, stagedMedia)
      await this.archive.cleanup(preview.archive)
      return { plan }
    })
  }

  async deleteRecoveryPoint(): Promise<void> {
    await this.archive.deleteRecoveryPoint()
  }

  private async preview(
    archive: InspectedBackupArchive,
    source: RestorePreview['source'],
  ): Promise<RestorePreview> {
    const current = await this.snapshot.loadRestoreState()
    const operationId = this.generateId()
    const appliedAtMs = this.now()
    const context = { operationId, appliedAtMs }
    return {
      archive,
      operationId,
      appliedAtMs,
      replacePlan: planRestore(current, archive.data, 'replace-all', context),
      mergePlan: planRestore(current, archive.data, 'merge-local-first', context),
      source,
    }
  }
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
