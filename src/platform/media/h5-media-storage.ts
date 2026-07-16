import type { MediaAsset, MediaAssetKind } from '@/domain/performance'
import type {
  PerformanceImageRole,
  PerformanceMediaStorage,
  PreparedImage,
  SelectedImage,
} from './types'

export class H5MediaStorage implements PerformanceMediaStorage {
  async prepare(role: PerformanceImageRole, selected: SelectedImage): Promise<PreparedImage> {
    const createdAtMs = Date.now()
    const originalKind: MediaAssetKind = role === 'poster' ? 'poster' : 'ticket_original'
    const thumbnailKind: MediaAssetKind = role === 'poster' ? 'poster_thumb' : 'ticket_thumb'
    const sha256 = await hashPreview(selected.previewPath)
    const assets: MediaAsset[] = [originalKind, thumbnailKind].map((kind) => ({
      id: createId(),
      kind,
      relativePath: selected.previewPath,
      mimeType: selected.mimeType,
      byteSize: selected.byteSize,
      sha256,
      width: null,
      height: null,
      createdAtMs,
    }))
    return { assets, rollback: async () => undefined }
  }

  async remove(): Promise<void> {
    // H5 previews use browser-owned temporary object URLs and are intentionally non-persistent.
  }
}

async function hashPreview(path: string): Promise<string> {
  try {
    const bytes = await (await fetch(path)).arrayBuffer()
    return sha256Hex(bytes)
  } catch {
    return sha256Hex(new TextEncoder().encode(path))
  }
}

async function sha256Hex(value: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
