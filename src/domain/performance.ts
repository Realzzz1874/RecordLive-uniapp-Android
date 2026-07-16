export enum PerformanceStatus {
  Normal = 0,
  Cancelled = 1,
  PendingSale = 2,
  Missed = 3,
}

export type PerformanceLifecycle =
  | 'attended'
  | 'upcoming'
  | 'cancelled'
  | 'pending-sale'
  | 'missed'

export type PerformanceFacetKind =
  | 'artist'
  | 'guest'
  | 'play'
  | 'channel'
  | 'friend'
  | 'company'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface CurrencyAmount {
  amount: string
  currency: string
}

export interface Performance {
  id: string
  name: string
  startedAtMs: number
  city: string
  venue: string
  remark: string
  ticketPrice: CurrencyAmount
  paidPrice: CurrencyAmount
  otherCost: CurrencyAmount
  seat: string
  rating: number
  status: PerformanceStatus
  categoryId: string | null
  coordinate: Coordinate | null
  tagIds: string[]
  facets: Partial<Record<PerformanceFacetKind, string[]>>
  createdAtMs: number
  updatedAtMs: number
}

export function derivePerformanceLifecycle(
  performance: Pick<Performance, 'startedAtMs' | 'status'>,
  referenceTimeMs = Date.now(),
): PerformanceLifecycle {
  switch (performance.status) {
    case PerformanceStatus.Cancelled:
      return 'cancelled'
    case PerformanceStatus.PendingSale:
      return 'pending-sale'
    case PerformanceStatus.Missed:
      return 'missed'
    case PerformanceStatus.Normal:
      return performance.startedAtMs < referenceTimeMs ? 'attended' : 'upcoming'
  }
}

