export interface AndroidBackupFileEntry {
  path: string
  byteSize: number
  sha256: string
}

export interface AndroidBackupManifestV1 {
  schemaVersion: 1
  backupKind: 'android-local'
  appVersion: string
  exportedAtMs: number
  dataFile: string
  files: AndroidBackupFileEntry[]
}

export function validateAndroidBackupManifest(
  input: unknown,
): AndroidBackupManifestV1 {
  if (!isRecord(input)) throw new Error('Backup manifest must be an object')
  if (input.schemaVersion !== 1) throw new Error('Unsupported backup schema version')
  if (input.backupKind !== 'android-local') throw new Error('Invalid backup kind')
  if (typeof input.appVersion !== 'string' || input.appVersion.trim() === '') {
    throw new Error('Backup app version is required')
  }
  if (
    typeof input.exportedAtMs !== 'number' ||
    !Number.isSafeInteger(input.exportedAtMs) ||
    input.exportedAtMs < 0
  ) {
    throw new Error('Invalid backup timestamp')
  }
  if (typeof input.dataFile !== 'string' || !isSafeRelativePath(input.dataFile)) {
    throw new Error('Invalid backup data file path')
  }
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error('Backup file list is required')
  }

  const paths = new Set<string>()
  const files = input.files.map((value, index) => validateFile(value, index, paths))
  if (!paths.has(input.dataFile)) {
    throw new Error('Backup data file is missing from file list')
  }

  return {
    schemaVersion: 1,
    backupKind: 'android-local',
    appVersion: input.appVersion,
    exportedAtMs: input.exportedAtMs,
    dataFile: input.dataFile,
    files,
  }
}

function validateFile(
  value: unknown,
  index: number,
  paths: Set<string>,
): AndroidBackupFileEntry {
  if (!isRecord(value)) throw new Error(`Backup file at index ${index} is invalid`)
  if (typeof value.path !== 'string' || !isSafeRelativePath(value.path)) {
    throw new Error(`Backup file path at index ${index} is invalid`)
  }
  if (paths.has(value.path)) throw new Error(`Duplicate backup file path: ${value.path}`)
  if (
    typeof value.byteSize !== 'number' ||
    !Number.isSafeInteger(value.byteSize) ||
    value.byteSize < 0
  ) {
    throw new Error(`Backup file size at index ${index} is invalid`)
  }
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256)) {
    throw new Error(`Backup file hash at index ${index} is invalid`)
  }

  paths.add(value.path)
  return {
    path: value.path,
    byteSize: value.byteSize,
    sha256: value.sha256.toLowerCase(),
  }
}

function isSafeRelativePath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false
  return path.split('/').every((segment) => segment !== '' && segment !== '..' && segment !== '.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

