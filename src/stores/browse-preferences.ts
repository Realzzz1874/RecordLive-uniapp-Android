import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  cloneBrowsePreferences,
  DEFAULT_BROWSE_PREFERENCES,
  normalizeBrowsePreferences,
  type PerformanceDisplayMode,
  type PerformanceFilter,
} from '@/features/preferences/model'
import { getAppRepositories } from '@/platform/repositories/context'

const BROWSE_PREFERENCES_KEY = 'performance-browse-preferences-v1'

export const useBrowsePreferencesStore = defineStore('browse-preferences', () => {
  const preferences = ref(cloneBrowsePreferences(DEFAULT_BROWSE_PREFERENCES))
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  const displayMode = computed(() => preferences.value.displayMode)
  const filter = computed(() => preferences.value.filter)

  function initialize(): Promise<void> {
    initialization ??= load()
    return initialization
  }

  async function load(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      const saved = await repositories.settings.get<unknown>(BROWSE_PREFERENCES_KEY)
      preferences.value = normalizeBrowsePreferences(saved)
    } finally {
      initialized.value = true
    }
  }

  function setFilter(value: PerformanceFilter): void {
    preferences.value = normalizeBrowsePreferences({
      ...preferences.value,
      filter: value,
    })
    void persist()
  }

  function resetFilter(): void {
    setFilter(cloneBrowsePreferences(DEFAULT_BROWSE_PREFERENCES).filter)
  }

  function setDisplayMode(value: PerformanceDisplayMode): void {
    preferences.value = {
      ...preferences.value,
      displayMode: value,
    }
    void persist()
  }

  async function persist(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      await repositories.settings.set(
        BROWSE_PREFERENCES_KEY,
        cloneBrowsePreferences(preferences.value),
      )
    } catch {
      // Keep the current session usable if settings persistence is temporarily unavailable.
    }
  }

  return {
    displayMode,
    filter,
    initialized,
    initialize,
    resetFilter,
    setDisplayMode,
    setFilter,
  }
})
