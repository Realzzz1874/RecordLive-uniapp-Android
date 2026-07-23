import { describe, expect, it, vi } from 'vitest'

import type { AndroidBackupDataV1, AndroidBackupManifestV1 } from '@/domain/backup'
import type { CurrentRestoreState, RestorePlan } from '@/domain/backup-restore-plan'
import type {
  BackupArchiveGateway,
  BackupMetadataRepository,
  BackupSnapshotRepository,
  InspectedBackupArchive,
  PreparedBackupArchive,
} from '@/features/backup/repository'
import { BackupUseCases } from '@/features/backup/use-cases'
import { DefaultDataOperationCoordinator } from '@/platform/backup/data-operation-coordinator'

describe('backup use cases', () => {
  it('creates a recovery point before applying a restore plan', async () => {
    const events: string[] = []
    const snapshot = new FakeSnapshot(events)
    const archive = new FakeArchive(events)
    const service = createService(snapshot, archive)
    const preview = await service.inspectRestoreFile()

    expect(preview).not.toBeNull()
    await service.restore(preview!, 'replace-all')

    expect(events).toEqual(['recovery', 'stage', 'apply', 'cleanup'])
    expect(snapshot.data.performances[0].id).toBe('backup')
  })

  it('does not change data when recovery point creation fails', async () => {
    const events: string[] = []
    const snapshot = new FakeSnapshot(events)
    const archive = new FakeArchive(events)
    archive.failRecovery = true
    const service = createService(snapshot, archive)
    const preview = await service.inspectRestoreFile()

    await expect(service.restore(preview!, 'replace-all')).rejects.toThrow('recovery failed')
    expect(events).toEqual(['recovery'])
    expect(snapshot.data.performances[0].id).toBe('local')
  })

  it('discards staged media when applying a restore plan fails', async () => {
    const events: string[] = []
    const snapshot = new FakeSnapshot(events)
    snapshot.failApply = true
    const archive = new FakeArchive(events)
    const service = createService(snapshot, archive)
    const preview = await service.inspectRestoreFile()

    await expect(service.restore(preview!, 'replace-all')).rejects.toThrow('apply failed')
    expect(events).toEqual(['recovery', 'stage', 'apply', 'discard:operation'])
    expect(snapshot.data.performances[0].id).toBe('local')
  })

  it('does not report a committed restore as failed when temporary cleanup fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const events: string[] = []
    const snapshot = new FakeSnapshot(events)
    const archive = new FakeArchive(events)
    archive.failCleanup = true
    const service = createService(snapshot, archive)
    const preview = await service.inspectRestoreFile()

    await expect(service.restore(preview!, 'replace-all')).resolves.toBeDefined()
    expect(events).toEqual(['recovery', 'stage', 'apply', 'cleanup'])
    expect(snapshot.data.performances[0].id).toBe('backup')
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('releases exclusive data access before opening the system save document flow', async () => {
    const events: string[] = []
    const coordinator = new DefaultDataOperationCoordinator()
    const snapshot = new FakeSnapshot(events)
    const archive = new FakeArchive(events)
    let releaseSave = () => {}
    archive.waitForSave = new Promise<void>((resolve) => { releaseSave = resolve })
    const service = createService(snapshot, archive, coordinator)

    const backup = service.createBackup()
    await archive.saveStarted
    await coordinator.withMutation(async () => {
      events.push('mutation')
    })

    expect(events).toEqual(['create', 'save-start', 'mutation'])
    releaseSave()
    await backup
    expect(events).toEqual(['create', 'save-start', 'mutation', 'save-end', 'cleanup'])
  })

  it('cleans stale work and unreferenced restore generations from the current snapshot', async () => {
    const events: string[] = []
    const snapshot = new FakeSnapshot(events)
    snapshot.mediaRelativePaths = {
      poster: '_doc/recordlive/media/restore-active/poster.jpg',
    }
    const archive = new FakeArchive(events)
    const service = new BackupUseCases(
      snapshot,
      archive,
      metadata,
      new DefaultDataOperationCoordinator(),
      () => 100_000_000,
      () => 'operation',
    )

    await service.cleanupStaleArtifacts()

    expect(archive.staleCleanup).toEqual({
      paths: ['_doc/recordlive/media/restore-active/poster.jpg'],
      cutoffMs: 13_600_000,
    })
  })

  it('blocks new mutations while exclusive data access is running', async () => {
    const coordinator = new DefaultDataOperationCoordinator()
    const events: string[] = []
    let releaseExclusive = () => {}
    const exclusive = coordinator.withExclusiveDataAccess(async () => {
      events.push('exclusive-start')
      await new Promise<void>((resolve) => { releaseExclusive = resolve })
      events.push('exclusive-end')
    })
    await Promise.resolve()
    const mutation = coordinator.withMutation(async () => {
      events.push('mutation')
    })
    await Promise.resolve()

    expect(events).toEqual(['exclusive-start'])
    releaseExclusive()
    await Promise.all([exclusive, mutation])
    expect(events).toEqual(['exclusive-start', 'exclusive-end', 'mutation'])
  })
})

class FakeSnapshot implements BackupSnapshotRepository {
  data = backupData('local')
  failApply = false
  mediaRelativePaths: Record<string, string> = {}

  constructor(private readonly events: string[]) {}

  async exportSnapshot(): Promise<AndroidBackupDataV1> {
    return clone(this.data)
  }

  async loadRestoreState(): Promise<CurrentRestoreState> {
    return {
      data: clone(this.data),
      deletedCategoryIds: [],
      deletedTagIds: [],
      deletedPerformanceIds: [],
      mediaRelativePaths: { ...this.mediaRelativePaths },
    }
  }

  async applyRestorePlan(plan: RestorePlan): Promise<void> {
    this.events.push('apply')
    if (this.failApply) throw new Error('apply failed')
    this.data = clone(plan.data)
  }
}

class FakeArchive implements BackupArchiveGateway {
  failRecovery = false
  failCleanup = false
  waitForSave: Promise<void> | null = null
  staleCleanup: { paths: readonly string[]; cutoffMs: number } | null = null
  private resolveSaveStarted = () => {}
  readonly saveStarted = new Promise<void>((resolve) => {
    this.resolveSaveStarted = resolve
  })

  constructor(private readonly events: string[]) {}

  async createArchive(
    data: AndroidBackupDataV1,
  ): Promise<PreparedBackupArchive> {
    this.events.push('create')
    return { operationId: 'op', sandboxPath: 'fake', suggestedName: 'fake.zip', manifest, data }
  }

  async saveArchiveToUserFile(): Promise<boolean> {
    this.events.push('save-start')
    this.resolveSaveStarted()
    await this.waitForSave
    this.events.push('save-end')
    return true
  }

  async chooseAndInspectRestoreFile(): Promise<InspectedBackupArchive> {
    return inspected(backupData('backup'))
  }

  async stageMedia(): Promise<Record<string, string>> {
    this.events.push('stage')
    return {}
  }

  async createRecoveryPoint(): Promise<void> {
    this.events.push('recovery')
    if (this.failRecovery) throw new Error('recovery failed')
  }

  async inspectRecoveryPoint(): Promise<InspectedBackupArchive | null> {
    return null
  }

  async deleteRecoveryPoint(): Promise<void> {}
  async hasRecoveryPoint(): Promise<boolean> { return false }
  async discardStagedMedia(operationId: string): Promise<void> {
    this.events.push(`discard:${operationId}`)
  }
  async cleanupStaleArtifacts(paths: readonly string[], cutoffMs: number): Promise<void> {
    this.staleCleanup = { paths, cutoffMs }
  }
  async cleanup(): Promise<void> {
    this.events.push('cleanup')
    if (this.failCleanup) throw new Error('cleanup failed')
  }
}

const metadata: BackupMetadataRepository = {
  async getLastBackupAtMs() { return null },
  async setLastBackupAtMs() {},
}

function createService(
  snapshot: FakeSnapshot,
  archive: FakeArchive,
  coordinator = new DefaultDataOperationCoordinator(),
): BackupUseCases {
  return new BackupUseCases(
    snapshot,
    archive,
    metadata,
    coordinator,
    () => 200,
    () => 'operation',
  )
}

function inspected(data: AndroidBackupDataV1): InspectedBackupArchive {
  return {
    selected: { uri: 'fake', displayName: 'fake.zip', byteSize: null },
    sandboxPath: 'fake',
    manifest,
    data,
  }
}

const manifest: AndroidBackupManifestV1 = {
  schemaVersion: 1,
  backupKind: 'android-local',
  appVersion: '0.1.0',
  exportedAtMs: 100,
  dataFile: 'data.json',
  files: [{ path: 'data.json', byteSize: 1, sha256: '0'.repeat(64) }],
}

function backupData(id: string): AndroidBackupDataV1 {
  return {
    performances: [{
      id,
      name: id,
      startedAtMs: 100,
      city: '',
      venue: '',
      remark: '',
      ticketPriceAmount: '0',
      ticketPriceCurrency: 'CNY',
      paidPriceAmount: '0',
      paidPriceCurrency: 'CNY',
      otherCostAmount: '0',
      otherCostCurrency: 'CNY',
      seat: '',
      rating: 0,
      status: 0,
      categoryId: null,
      latitude: null,
      longitude: null,
      createdAtMs: 100,
      updatedAtMs: 100,
    }],
    categories: [],
    tags: [],
    performanceTags: [],
    performanceFacets: [],
    songs: [],
    mediaAssets: [],
    settings: [],
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
