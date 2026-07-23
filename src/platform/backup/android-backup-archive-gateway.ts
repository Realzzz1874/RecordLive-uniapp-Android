import {
  validateAndroidBackupData,
  validateAndroidBackupManifest,
  type AndroidBackupDataV1,
  type AndroidBackupFileEntry,
  type AndroidBackupManifestV1,
} from '@/domain/backup'
import type { RestorePlan, RestorePlanContext } from '@/domain/backup-restore-plan'
import type { RestoreMediaSource } from '@/domain/backup-restore-plan'
import type {
  BackupArchiveGateway,
  InspectedBackupArchive,
  PreparedBackupArchive,
  SelectedBackupFile,
} from '@/features/backup/repository'
import * as nativeBackup from '@/uni_modules/recordlive-backup'

const WORK_ROOT = '_doc/recordlive/backup-work'
const RECOVERY_PATH = '_doc/recordlive/recovery/last-before-restore.backup.zip'
const LIMITS: nativeBackup.ZipLimits = {
  maxArchiveBytes: 2 * 1024 * 1024 * 1024,
  maxEntryCount: 2_000,
  maxEntryBytes: 512 * 1024 * 1024,
  maxExtractedBytes: 4 * 1024 * 1024 * 1024,
}

export class AndroidBackupArchiveGateway implements BackupArchiveGateway {
  readonly runtime = 'android' as const

  async createArchive(
    data: AndroidBackupDataV1,
    context: RestorePlanContext,
    mediaSourcePaths: Record<string, string>,
  ): Promise<PreparedBackupArchive> {
    const workDirectory = `${WORK_ROOT}/${context.operationId}`
    const sourceDirectory = `${workDirectory}/source`
    const zipPath = `${workDirectory}/prepared.backup.zip`
    await ensureEmptyDirectory(sourceDirectory)
    await writeTextFile(`${sourceDirectory}/data.json`, JSON.stringify(data))
    await ensureDirectory(`${sourceDirectory}/media`)

    for (const asset of data.mediaAssets) {
      const source = mediaSourcePaths[asset.id]
      if (!source) throw new Error(`找不到媒体文件路径：${asset.id}`)
      await copyFile(source, `${sourceDirectory}/${asset.archivePath}`)
    }

    const dataEntry = await fileEntry(`${sourceDirectory}/data.json`, 'data.json')
    const mediaEntries = await Promise.all(data.mediaAssets.map((asset) =>
      fileEntry(`${sourceDirectory}/${asset.archivePath}`, asset.archivePath)))
    const manifest: AndroidBackupManifestV1 = {
      schemaVersion: 1,
      backupKind: 'android-local',
      appVersion: '0.1.0',
      exportedAtMs: context.appliedAtMs,
      dataFile: 'data.json',
      files: [dataEntry, ...mediaEntries],
    }
    await writeTextFile(`${sourceDirectory}/manifest.json`, JSON.stringify(manifest))
    await createZip(absolute(sourceDirectory), absolute(zipPath))
    await verifyArchive(zipPath)
    return {
      operationId: context.operationId,
      sandboxPath: zipPath,
      suggestedName: backupFileName(context.appliedAtMs),
      manifest,
      data,
    }
  }

  async saveArchiveToUserFile(archive: PreparedBackupArchive): Promise<boolean> {
    const document = await createDocument(archive.suggestedName)
    if (!document) return false
    await copySandboxToUri(absolute(archive.sandboxPath), document.uri)
    return true
  }

  async chooseAndInspectRestoreFile(): Promise<InspectedBackupArchive | null> {
    const selected = await openDocument()
    if (!selected) return null
    if (selected.byteSize !== null && selected.byteSize > LIMITS.maxArchiveBytes) {
      throw new Error('备份文件超过 2 GB 限制')
    }
    const operationId = createOperationId()
    const zipPath = `${WORK_ROOT}/${operationId}/selected.backup.zip`
    await ensureDirectory(`${WORK_ROOT}/${operationId}`)
    await copyUriToSandbox(selected.uri, absolute(zipPath), LIMITS.maxArchiveBytes)
    return inspectArchive(zipPath, selected)
  }

  async stageMedia(
    archive: InspectedBackupArchive,
    plan: RestorePlan,
  ): Promise<Record<string, string>> {
    const backupSources = plan.mediaSources.filter(isBackupMediaSource)
    if (backupSources.length === 0) return {}
    const extractDirectory = `${WORK_ROOT}/${plan.operationId}/extracted`
    const generationDirectory = `_doc/recordlive/media/restore-${plan.operationId}`
    await ensureEmptyDirectory(extractDirectory)
    await ensureEmptyDirectory(generationDirectory)
    const byPath = new Map(archive.manifest.files.map((entry) => [entry.path, entry]))
    const expected = backupSources.map((source) => {
      const entry = byPath.get(source.archivePath)
      if (!entry) throw new Error(`备份媒体清单缺失：${source.archivePath}`)
      return entry
    })
    const requiredBytes = expected.reduce((sum, { byteSize }) => sum + byteSize, 0)
    const freeBytes = await availableBytes(absolute('_doc/recordlive'))
    if (freeBytes < requiredBytes * 1.2 + 16 * 1024 * 1024) {
      throw new Error('应用沙盒可用空间不足，无法安全恢复媒体')
    }
    await extractZip(
      absolute(archive.sandboxPath),
      absolute(extractDirectory),
      expected,
    )
    const result: Record<string, string> = {}
    for (const source of backupSources) {
      const target = `${generationDirectory}/${source.assetId}.jpg`
      await copyFile(`${extractDirectory}/${source.archivePath}`, target)
      result[source.assetId] = target
    }
    return result
  }

  async createRecoveryPoint(
    data: AndroidBackupDataV1,
    context: RestorePlanContext,
    mediaSourcePaths: Record<string, string>,
  ): Promise<void> {
    const prepared = await this.createArchive(data, context, mediaSourcePaths)
    try {
      const temporary = `${RECOVERY_PATH}.tmp`
      await ensureDirectory('_doc/recordlive/recovery')
      await copyFile(prepared.sandboxPath, temporary)
      await verifyArchive(temporary)
      await replaceFile(temporary, RECOVERY_PATH)
    } finally {
      await this.cleanup(prepared)
    }
  }

  async inspectRecoveryPoint(): Promise<InspectedBackupArchive | null> {
    if (!await fileExists(RECOVERY_PATH)) return null
    const operationId = createOperationId()
    const copied = `${WORK_ROOT}/${operationId}/recovery-source.backup.zip`
    await ensureDirectory(`${WORK_ROOT}/${operationId}`)
    await copyFile(RECOVERY_PATH, copied)
    return inspectArchive(copied, {
      uri: RECOVERY_PATH,
      displayName: '撤销上次恢复',
      byteSize: null,
    })
  }

  async deleteRecoveryPoint(): Promise<void> {
    await removeEntry(RECOVERY_PATH)
  }

  async hasRecoveryPoint(): Promise<boolean> {
    return fileExists(RECOVERY_PATH)
  }

  async cleanup(archive?: PreparedBackupArchive | InspectedBackupArchive): Promise<void> {
    if (!archive) return
    const path = archive.sandboxPath
    const marker = '/backup-work/'
    const index = path.indexOf(marker)
    if (index < 0) return
    const operationRoot = path.slice(0, path.indexOf('/', index + marker.length))
    await removeEntry(operationRoot)
  }
}

function isBackupMediaSource(
  source: RestoreMediaSource,
): source is Extract<RestoreMediaSource, { source: 'backup' }> {
  return source.source === 'backup'
}

async function inspectArchive(
  zipPath: string,
  selected: SelectedBackupFile,
): Promise<InspectedBackupArchive> {
  const entries = await inspectZip(absolute(zipPath))
  const entryPaths = entries.filter(({ directory }) => !directory).map(({ path }) => path)
  const manifestText = await readZipText(absolute(zipPath), 'manifest.json', 1024 * 1024)
  const manifest = validateAndroidBackupManifest(JSON.parse(manifestText))
  const allowed = new Set(['manifest.json', ...manifest.files.map(({ path }) => path)])
  for (const entry of entries) {
    if (entry.encrypted) throw new Error(`不支持加密 ZIP 条目：${entry.path}`)
    if (!entry.directory && !allowed.has(entry.path)) throw new Error(`备份包含未知文件：${entry.path}`)
    if (entry.directory && entry.path !== 'media/' && entry.path !== 'media') {
      throw new Error(`备份包含未知目录：${entry.path}`)
    }
  }
  if (entryPaths.length !== allowed.size || [...allowed].some((path) => !entryPaths.includes(path))) {
    throw new Error('ZIP 条目与 manifest 文件清单不一致')
  }
  const validationDirectory = `${zipPath}.validation`
  await ensureEmptyDirectory(validationDirectory)
  try {
    await extractZip(absolute(zipPath), absolute(validationDirectory), manifest.files)
    const dataText = await readZipText(absolute(zipPath), manifest.dataFile, 64 * 1024 * 1024)
    const data = validateAndroidBackupData(JSON.parse(dataText))
    validateMediaManifest(data, manifest)
    return { selected, sandboxPath: zipPath, manifest, data }
  } finally {
    await removeEntry(validationDirectory)
  }
}

function validateMediaManifest(data: AndroidBackupDataV1, manifest: AndroidBackupManifestV1): void {
  const files = new Map(manifest.files.map((entry) => [entry.path, entry]))
  const expectedPaths = new Set([manifest.dataFile, ...data.mediaAssets.map(({ archivePath }) => archivePath)])
  if (files.size !== expectedPaths.size || [...files.keys()].some((path) => !expectedPaths.has(path))) {
    throw new Error('manifest 文件清单与 data.json 媒体引用不一致')
  }
  for (const asset of data.mediaAssets) {
    const entry = files.get(asset.archivePath)
    if (!entry || entry.byteSize !== asset.byteSize || entry.sha256 !== asset.sha256) {
      throw new Error(`媒体清单校验失败：${asset.archivePath}`)
    }
  }
}

async function verifyArchive(zipPath: string): Promise<void> {
  await inspectArchive(zipPath, { uri: zipPath, displayName: 'internal', byteSize: null })
}

async function fileEntry(path: string, archivePath: string): Promise<AndroidBackupFileEntry> {
  const [byteSize, sha256] = await Promise.all([
    fileSize(path),
    hashFile(absolute(path)),
  ])
  return { path: archivePath, byteSize, sha256 }
}

function absolute(path: string): string {
  return plus.io.convertLocalFileSystemURL(path)
}

function backupFileName(timestamp: number): string {
  const date = new Date(timestamp)
  const part = (value: number) => String(value).padStart(2, '0')
  return `RecordLive-Android-${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}.backup.zip`
}

function createOperationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createDocument(name: string): Promise<nativeBackup.LocalDocument | null> {
  return new Promise((resolve, reject) => nativeBackup.createLocalDocument(
    name,
    resolve,
    () => resolve(null),
    (message) => reject(new Error(message)),
  ))
}

function openDocument(): Promise<nativeBackup.LocalDocument | null> {
  return new Promise((resolve, reject) => nativeBackup.openLocalBackupDocument(
    resolve,
    () => resolve(null),
    (message) => reject(new Error(message)),
  ))
}

function copyUriToSandbox(uri: string, destination: string, maxBytes: number): Promise<void> {
  return new Promise((resolve, reject) => nativeBackup.copyUriToSandbox(
    uri, destination, maxBytes, resolve, (message) => reject(new Error(message)),
  ))
}

function copySandboxToUri(source: string, uri: string): Promise<void> {
  return new Promise((resolve, reject) => nativeBackup.copySandboxToUri(
    source, uri, resolve, (message) => reject(new Error(message)),
  ))
}

function createZip(source: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => nativeBackup.createZip(
    source, destination, resolve, (message) => reject(new Error(message)),
  ))
}

function inspectZip(path: string): Promise<nativeBackup.ZipEntryInfo[]> {
  return new Promise((resolve, reject) => nativeBackup.inspectZip(
    path, LIMITS, resolve, (message) => reject(new Error(message)),
  ))
}

function readZipText(path: string, entry: string, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => nativeBackup.readUtf8ZipEntry(
    path, entry, maxBytes, resolve, (message) => reject(new Error(message)),
  ))
}

function extractZip(
  path: string,
  destination: string,
  expected: AndroidBackupFileEntry[],
): Promise<void> {
  return new Promise((resolve, reject) => nativeBackup.extractZipEntries(
    path, destination, expected, LIMITS, resolve, (message) => reject(new Error(message)),
  ))
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => nativeBackup.sha256File(
    path, resolve, (message) => reject(new Error(message)),
  ))
}

function availableBytes(path: string): Promise<number> {
  return new Promise((resolve, reject) => nativeBackup.availableBytes(
    path, resolve, (message) => reject(new Error(message)),
  ))
}

async function ensureEmptyDirectory(path: string): Promise<void> {
  await removeEntry(path)
  await ensureDirectory(path)
}

async function ensureDirectory(path: string): Promise<void> {
  const segments = path.replace(/^_doc\/?/, '').split('/').filter(Boolean)
  let current = await resolveEntry('_doc/') as PlusIoDirectoryEntry
  for (const segment of segments) {
    current = await new Promise<PlusIoDirectoryEntry>((resolve, reject) =>
      current.getDirectory(segment, { create: true }, resolve, reject))
  }
}

async function writeTextFile(path: string, content: string): Promise<void> {
  const slash = path.lastIndexOf('/')
  await ensureDirectory(path.slice(0, slash))
  const directory = await resolveEntry(path.slice(0, slash)) as PlusIoDirectoryEntry
  const file = await new Promise<PlusIoFileEntry>((resolve, reject) =>
    directory.getFile(path.slice(slash + 1), { create: true }, resolve, reject))
  const writer = await new Promise<PlusIoFileWriter>((resolve, reject) => file.createWriter(resolve, reject))
  await new Promise<void>((resolve, reject) => {
    writer.onwrite = () => resolve()
    writer.onerror = reject
    writer.write(content)
  })
}

async function copyFile(sourcePath: string, targetPath: string): Promise<void> {
  const source = await resolveEntry(sourcePath) as PlusIoFileEntry
  const slash = targetPath.lastIndexOf('/')
  const directoryPath = targetPath.slice(0, slash)
  const name = targetPath.slice(slash + 1)
  await ensureDirectory(directoryPath)
  const directory = await resolveEntry(directoryPath) as PlusIoDirectoryEntry
  await removeEntry(targetPath)
  await new Promise<void>((resolve, reject) => source.copyTo(directory, name, () => resolve(), reject))
}

async function replaceFile(sourcePath: string, targetPath: string): Promise<void> {
  await removeEntry(targetPath)
  const source = await resolveEntry(sourcePath) as PlusIoFileEntry
  const slash = targetPath.lastIndexOf('/')
  const directory = await resolveEntry(targetPath.slice(0, slash)) as PlusIoDirectoryEntry
  await new Promise<void>((resolve, reject) =>
    source.moveTo(directory, targetPath.slice(slash + 1), () => resolve(), reject))
}

async function fileSize(path: string): Promise<number> {
  const entry = await resolveEntry(path) as PlusIoFileEntry
  return new Promise((resolve, reject) => entry.getMetadata(
    (metadata) => resolve(Number(metadata.size ?? 0)),
    reject,
  ))
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await resolveEntry(path)
    return true
  } catch {
    return false
  }
}

async function removeEntry(path: string): Promise<void> {
  let entry: PlusIoFileEntry | PlusIoDirectoryEntry
  try {
    entry = await resolveEntry(path)
  } catch {
    return
  }
  await new Promise<void>((resolve, reject) => {
    if (entry.isDirectory) {
      ;(entry as PlusIoDirectoryEntry).removeRecursively(() => resolve(), reject)
    } else {
      entry.remove(() => resolve(), reject)
    }
  })
}

function resolveEntry(path: string): Promise<PlusIoFileEntry | PlusIoDirectoryEntry> {
  return new Promise((resolve, reject) => plus.io.resolveLocalFileSystemURL(path, resolve, reject))
}
