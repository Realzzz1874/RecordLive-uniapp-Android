import type { MediaAsset } from '@/domain/performance'

export type PerformanceImageRole = 'poster' | 'ticket'

export interface SelectedImage {
  sourcePath: string
  previewPath: string
  byteSize: number
  mimeType: string
}

export interface PreparedImage {
  assets: MediaAsset[]
  rollback(): Promise<void>
}

export interface PerformanceMediaStorage {
  prepare(role: PerformanceImageRole, selected: SelectedImage): Promise<PreparedImage>
  remove(relativePaths: readonly string[]): Promise<void>
}
