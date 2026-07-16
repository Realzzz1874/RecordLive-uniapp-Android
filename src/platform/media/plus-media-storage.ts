import type { MediaAsset, MediaAssetKind } from '@/domain/performance'
import type {
  PerformanceImageRole,
  PerformanceMediaStorage,
  PreparedImage,
  SelectedImage,
} from './types'

const MEDIA_DIRECTORY = '_doc/recordlive/media'

export class PlusMediaStorage implements PerformanceMediaStorage {
  async prepare(role: PerformanceImageRole, selected: SelectedImage): Promise<PreparedImage> {
    await ensureMediaDirectory()
    const groupId = createId()
    const originalPath = `${MEDIA_DIRECTORY}/${groupId}-${role}.jpg`
    const thumbnailPath = `${MEDIA_DIRECTORY}/${groupId}-${role}-thumb.jpg`
    const createdPaths: string[] = []

    try {
      await compressImage(selected.sourcePath, originalPath, '2048px', 88)
      createdPaths.push(originalPath)
      await compressImage(originalPath, thumbnailPath, '480px', 76)
      createdPaths.push(thumbnailPath)

      const [original, thumbnail] = await Promise.all([
        createAsset(role === 'poster' ? 'poster' : 'ticket_original', originalPath),
        createAsset(role === 'poster' ? 'poster_thumb' : 'ticket_thumb', thumbnailPath),
      ])
      return {
        assets: [original, thumbnail],
        rollback: () => this.remove(createdPaths),
      }
    } catch (error) {
      await this.remove(createdPaths)
      throw error
    }
  }

  async remove(relativePaths: readonly string[]): Promise<void> {
    await Promise.all(relativePaths.map(removeFileIfPresent))
  }
}

async function ensureMediaDirectory(): Promise<void> {
  const recordLive = await new Promise<PlusIoDirectoryEntry>((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      '_doc/',
      (root) => root.getDirectory('recordlive', { create: true }, resolve, reject),
      reject,
    )
  })
  await new Promise<void>((resolve, reject) => {
    recordLive.getDirectory('media', { create: true }, () => resolve(), reject)
  })
}

async function compressImage(
  sourcePath: string,
  destinationPath: string,
  width: string,
  quality: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    plus.zip.compressImage(
      {
        src: sourcePath,
        dst: destinationPath,
        width,
        quality,
        format: 'jpg',
        overwrite: false,
      },
      () => resolve(),
      (error) => reject(toMediaError('处理图片', error)),
    )
  })
}

async function createAsset(kind: MediaAssetKind, relativePath: string): Promise<MediaAsset> {
  const entry = await resolveFile(relativePath)
  const file = await new Promise<PlusIoFile>((resolve, reject) => entry.file(resolve, reject))
  const byteSize = Number(file.size ?? 0)
  return {
    id: createId(),
    kind,
    relativePath,
    mimeType: file.type || 'image/jpeg',
    byteSize: Number.isSafeInteger(byteSize) && byteSize >= 0 ? byteSize : 0,
    sha256: await hashFile(file),
    width: null,
    height: null,
    createdAtMs: Date.now(),
  }
}

async function hashFile(file: PlusIoFile): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new plus.io.FileReader()
    reader.onload = () => resolve(reader.result ?? '')
    reader.onerror = () => reject(new Error('读取图片校验数据失败'))
    reader.readAsDataURL(file)
  })
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function removeFileIfPresent(path: string): Promise<void> {
  try {
    const entry = await resolveFile(path)
    await new Promise<void>((resolve) => entry.remove(() => resolve(), () => resolve()))
  } catch {
    // Missing files are already in the desired state.
  }
}

function resolveFile(path: string): Promise<PlusIoFileEntry> {
  return new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      path,
      (entry) => resolve(entry as unknown as PlusIoFileEntry),
      reject,
    )
  })
}

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function toMediaError(operation: string, value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return new Error(`${operation}失败：${String(value.message)}`)
  }
  return new Error(`${operation}失败`)
}
