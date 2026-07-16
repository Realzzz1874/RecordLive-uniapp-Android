import { describe, expect, it } from 'vitest'

import {
  derivePerformanceLifecycle,
  PerformanceStatus,
} from '@/domain/performance'

describe('performance lifecycle', () => {
  const referenceTimeMs = 1_800_000_000_000

  it('derives attended and upcoming only for normal performances', () => {
    expect(
      derivePerformanceLifecycle(
        { startedAtMs: referenceTimeMs - 1, status: PerformanceStatus.Normal },
        referenceTimeMs,
      ),
    ).toBe('attended')

    expect(
      derivePerformanceLifecycle(
        { startedAtMs: referenceTimeMs + 1, status: PerformanceStatus.Normal },
        referenceTimeMs,
      ),
    ).toBe('upcoming')
  })

  it('does not let time override explicit cancellation, pending sale, or missed states', () => {
    expect(
      derivePerformanceLifecycle(
        { startedAtMs: referenceTimeMs + 1, status: PerformanceStatus.Cancelled },
        referenceTimeMs,
      ),
    ).toBe('cancelled')
    expect(
      derivePerformanceLifecycle(
        { startedAtMs: referenceTimeMs - 1, status: PerformanceStatus.PendingSale },
        referenceTimeMs,
      ),
    ).toBe('pending-sale')
    expect(
      derivePerformanceLifecycle(
        { startedAtMs: referenceTimeMs + 1, status: PerformanceStatus.Missed },
        referenceTimeMs,
      ),
    ).toBe('missed')
  })
})

