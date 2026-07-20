import type { AppSettingsRepository } from '@/features/preferences/repository'

const STORAGE_PREFIX = 'recordlive.setting.'

export class UniStorageAppSettingsRepository implements AppSettingsRepository {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value: unknown = uni.getStorageSync(`${STORAGE_PREFIX}${key}`)
      return value === '' || value === undefined || value === null ? null : value as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    uni.setStorageSync(`${STORAGE_PREFIX}${key}`, value)
  }
}
