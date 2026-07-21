export const QUICK_ADD_PREFERENCES_KEY = 'quick-add-preferences-v1'

export interface QuickAddPreferences {
  copyExisting: boolean
  chineseMusicalSchedule: boolean
  chineseMusicalCity: string
}

export const DEFAULT_QUICK_ADD_PREFERENCES: QuickAddPreferences = {
  copyExisting: true,
  chineseMusicalSchedule: true,
  chineseMusicalCity: '上海',
}

export function normalizeQuickAddPreferences(value: unknown): QuickAddPreferences {
  if (!isRecord(value)) return { ...DEFAULT_QUICK_ADD_PREFERENCES }
  return {
    copyExisting: typeof value.copyExisting === 'boolean'
      ? value.copyExisting
      : DEFAULT_QUICK_ADD_PREFERENCES.copyExisting,
    chineseMusicalSchedule: typeof value.chineseMusicalSchedule === 'boolean'
      ? value.chineseMusicalSchedule
      : DEFAULT_QUICK_ADD_PREFERENCES.chineseMusicalSchedule,
    chineseMusicalCity: typeof value.chineseMusicalCity === 'string' && value.chineseMusicalCity.trim()
      ? value.chineseMusicalCity.trim()
      : DEFAULT_QUICK_ADD_PREFERENCES.chineseMusicalCity,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
