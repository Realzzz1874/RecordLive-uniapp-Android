import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  DEFAULT_QUICK_ADD_PREFERENCES,
  normalizeQuickAddPreferences,
  QUICK_ADD_PREFERENCES_KEY,
  type QuickAddPreferences,
} from '@/features/preferences/quick-add'
import { getAppRepositories } from '@/platform/repositories/context'

export const useQuickAddPreferencesStore = defineStore('quick-add-preferences', () => {
  const preferences = ref<QuickAddPreferences>({ ...DEFAULT_QUICK_ADD_PREFERENCES })
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  const copyExisting = computed(() => preferences.value.copyExisting)
  const parseLink = computed(() => preferences.value.parseLink)
  const chineseMusicalSchedule = computed(() => preferences.value.chineseMusicalSchedule)
  const koreanMusicalSchedule = computed(() => preferences.value.koreanMusicalSchedule)
  const chineseMusicalCity = computed(() => preferences.value.chineseMusicalCity)

  function initialize(): Promise<void> {
    initialization ??= load()
    return initialization
  }

  async function load(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      const saved = await repositories.settings.get<unknown>(QUICK_ADD_PREFERENCES_KEY)
      preferences.value = normalizeQuickAddPreferences(saved)
    } finally {
      initialized.value = true
    }
  }

  function setCopyExisting(value: boolean): void {
    preferences.value = { ...preferences.value, copyExisting: value }
    void persist()
  }

  function setParseLink(value: boolean): void {
    preferences.value = { ...preferences.value, parseLink: value }
    void persist()
  }

  function setChineseMusicalSchedule(value: boolean): void {
    preferences.value = { ...preferences.value, chineseMusicalSchedule: value }
    void persist()
  }

  function setKoreanMusicalSchedule(value: boolean): void {
    preferences.value = { ...preferences.value, koreanMusicalSchedule: value }
    void persist()
  }

  function setChineseMusicalCity(value: string): void {
    const city = value.trim()
    if (!city) return
    preferences.value = { ...preferences.value, chineseMusicalCity: city }
    void persist()
  }

  async function persist(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      await repositories.settings.set(QUICK_ADD_PREFERENCES_KEY, { ...preferences.value })
    } catch {
      // Keep the current session usable if settings persistence is temporarily unavailable.
    }
  }

  return {
    copyExisting,
    parseLink,
    chineseMusicalSchedule,
    koreanMusicalSchedule,
    chineseMusicalCity,
    initialized,
    initialize,
    setCopyExisting,
    setParseLink,
    setChineseMusicalSchedule,
    setKoreanMusicalSchedule,
    setChineseMusicalCity,
  }
})
