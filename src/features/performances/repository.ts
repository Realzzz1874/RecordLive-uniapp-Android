import type {
  Performance,
  PerformanceLifecycle,
  PerformanceStatus,
} from '@/domain/performance'

export type PerformanceSortDirection = 'ascending' | 'descending'

export interface PerformanceQuery {
  search?: string
  categoryId?: string
  categoryIds?: readonly string[]
  tagIds?: readonly string[]
  tagIdsAny?: readonly string[]
  statuses?: readonly PerformanceStatus[]
  lifecycles?: readonly PerformanceLifecycle[]
  referenceTimeMs?: number
  startedFromMs?: number
  startedToMs?: number
  sortDirection?: PerformanceSortDirection
  offset?: number
  limit?: number
}

export interface PerformancePage {
  items: Performance[]
  total: number
  hasMore: boolean
}

export interface PerformanceDraft
  extends Omit<Performance, 'id' | 'createdAtMs' | 'updatedAtMs'> {
  id?: string
}

export interface PerformanceRepository {
  get(id: string): Promise<Performance | null>
  list(query?: PerformanceQuery): Promise<PerformancePage>
  save(draft: PerformanceDraft): Promise<Performance>
  remove(id: string): Promise<void>
}
