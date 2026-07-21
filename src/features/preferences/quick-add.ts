export const QUICK_ADD_PREFERENCES_KEY = 'quick-add-preferences-v1'

export interface QuickAddPreferences {
  copyExisting: boolean
  parseLink: boolean
  chineseMusicalSchedule: boolean
  koreanMusicalSchedule: boolean
  chineseMusicalCity: string
}

export const DEFAULT_QUICK_ADD_PREFERENCES: QuickAddPreferences = {
  copyExisting: true,
  parseLink: true,
  chineseMusicalSchedule: true,
  koreanMusicalSchedule: true,
  chineseMusicalCity: '上海',
}

export function normalizeQuickAddPreferences(value: unknown): QuickAddPreferences {
  if (!isRecord(value)) return { ...DEFAULT_QUICK_ADD_PREFERENCES }
  return {
    copyExisting: typeof value.copyExisting === 'boolean'
      ? value.copyExisting
      : DEFAULT_QUICK_ADD_PREFERENCES.copyExisting,
    parseLink: typeof value.parseLink === 'boolean'
      ? value.parseLink
      : DEFAULT_QUICK_ADD_PREFERENCES.parseLink,
    chineseMusicalSchedule: typeof value.chineseMusicalSchedule === 'boolean'
      ? value.chineseMusicalSchedule
      : DEFAULT_QUICK_ADD_PREFERENCES.chineseMusicalSchedule,
    koreanMusicalSchedule: typeof value.koreanMusicalSchedule === 'boolean'
      ? value.koreanMusicalSchedule
      : DEFAULT_QUICK_ADD_PREFERENCES.koreanMusicalSchedule,
    chineseMusicalCity: typeof value.chineseMusicalCity === 'string' && value.chineseMusicalCity.trim()
      ? value.chineseMusicalCity.trim()
      : DEFAULT_QUICK_ADD_PREFERENCES.chineseMusicalCity,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
