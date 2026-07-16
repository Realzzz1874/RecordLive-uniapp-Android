import { H5MediaStorage } from './h5-media-storage'
import { PlusMediaStorage } from './plus-media-storage'
import type { PerformanceMediaStorage } from './types'

export function createPerformanceMediaStorage(): PerformanceMediaStorage {
  // #ifdef APP-PLUS
  return new PlusMediaStorage()
  // #endif

  // #ifndef APP-PLUS
  return new H5MediaStorage()
  // #endif
}
