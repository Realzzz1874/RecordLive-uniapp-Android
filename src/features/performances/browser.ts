import { DomainNotFoundError } from '@/domain/errors'
import {
  derivePerformanceLifecycle,
  type Performance,
  type PerformanceLifecycle,
} from '@/domain/performance'
import type { PerformanceRepository } from '@/features/performances/repository'
import type { PerformanceMediaStorage } from '@/platform/media/types'

export interface PerformanceRemovalResult {
  mediaCleanupFailed: boolean
}

export class PerformanceBrowserService {
  constructor(
    private readonly repository: PerformanceRepository,
    private readonly mediaStorage: PerformanceMediaStorage,
  ) {}

  async remove(id: string): Promise<PerformanceRemovalResult> {
    const performance = await this.repository.get(id)
    if (!performance) throw new DomainNotFoundError('演出记录不存在')

    await this.repository.remove(id)
    const paths = [...new Set(
      performance.mediaAssets.map(({ relativePath }) => relativePath).filter(Boolean),
    )]
    try {
      await this.mediaStorage.remove(paths)
      return { mediaCleanupFailed: false }
    } catch {
      return { mediaCleanupFailed: true }
    }
  }
}

export function performanceLifecycleLabel(
  performance: Pick<Performance, 'startedAtMs' | 'status'>,
  referenceTimeMs = Date.now(),
): string {
  const labels: Record<PerformanceLifecycle, string> = {
    attended: '已看',
    upcoming: '待看',
    cancelled: '已取消',
    'pending-sale': '待开票',
    missed: '未赴约',
  }
  return labels[derivePerformanceLifecycle(performance, referenceTimeMs)]
}

export function performanceMediaPath(
  performance: Pick<Performance, 'mediaAssets'>,
  role: 'poster' | 'ticket',
): string {
  const kinds = role === 'poster'
    ? ['poster_thumb', 'poster'] as const
    : ['ticket_thumb', 'ticket_original'] as const
  return kinds
    .map((kind) => performance.mediaAssets.find((asset) => asset.kind === kind)?.relativePath)
    .find(Boolean) ?? ''
}

export function formatPerformanceDate(timestamp: number, includeTime = false): string {
  const date = new Date(timestamp)
  const dateText = `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`
  return includeTime ? `${dateText} ${pad(date.getHours())}:${pad(date.getMinutes())}` : dateText
}

export function formatPerformanceLocation(
  performance: Pick<Performance, 'city' | 'venue'>,
): string {
  return [performance.city, performance.venue].map((value) => value.trim()).filter(Boolean).join(' · ')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
