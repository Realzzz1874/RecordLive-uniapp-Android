export interface LocalDocument {
  uri: string
  displayName: string
  byteSize: number | null
}

export interface ZipLimits {
  maxArchiveBytes: number
  maxEntryCount: number
  maxEntryBytes: number
  maxExtractedBytes: number
}

export interface ZipEntryInfo {
  path: string
  compressedBytes: number
  uncompressedBytes: number
  directory: boolean
  encrypted: boolean
}

export interface ZipExpectedEntry {
  path: string
  byteSize: number
  sha256: string
}

type Fail = (message: string) => void

export function createLocalDocument(
  suggestedName: string,
  success: (document: LocalDocument) => void,
  cancel: () => void,
  fail: Fail,
): void
export function openLocalBackupDocument(
  success: (document: LocalDocument) => void,
  cancel: () => void,
  fail: Fail,
): void
export function copyUriToSandbox(
  uri: string,
  destinationPath: string,
  maxBytes: number,
  success: () => void,
  fail: Fail,
): void
export function copySandboxToUri(
  sourcePath: string,
  uri: string,
  success: () => void,
  fail: Fail,
): void
export function createZip(
  sourceDirectoryPath: string,
  destinationZipPath: string,
  success: () => void,
  fail: Fail,
): void
export function inspectZip(
  zipPath: string,
  limits: ZipLimits,
  success: (entries: ZipEntryInfo[]) => void,
  fail: Fail,
): void
export function readUtf8ZipEntry(
  zipPath: string,
  entryPath: string,
  maxBytes: number,
  success: (content: string) => void,
  fail: Fail,
): void
export function extractZipEntries(
  zipPath: string,
  destinationDirectoryPath: string,
  expectedEntries: ZipExpectedEntry[],
  limits: ZipLimits,
  success: () => void,
  fail: Fail,
): void
export function sha256File(
  path: string,
  success: (sha256: string) => void,
  fail: Fail,
): void
export function availableBytes(
  path: string,
  success: (bytes: number) => void,
  fail: Fail,
): void
export function cleanupStaleBackupArtifacts(
  mediaRootPath: string,
  workRootPath: string,
  referencedMediaPaths: string[],
  cutoffMs: number,
  success: () => void,
  fail: Fail,
): void
export function cancelPendingDocumentRequests(): void
