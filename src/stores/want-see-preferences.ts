import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  DEFAULT_WANT_SEE_PREFERENCES,
  normalizeWantSeePreferences,
  type WantSeeDisplayMode,
} from '@/features/want-see/model'
import { getAppRepositories } from '@/platform/repositories/context'

const WANT_SEE_PREFERENCES_KEY = 'want-see-preferences-v1'

export const useWantSeePreferencesStore = defineStore('want-see-preferences', () => {
  const preferences = ref({ ...DEFAULT_WANT_SEE_PREFERENCES })
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  const displayMode = computed(() => preferences.value.displayMode)
  const includePendingSale = computed(() => preferences.value.includePendingSale)

  function initialize(): Promise<void> {
    initialization ??= load()
    return initialization
  }

  async function load(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      const saved = await repositories.settings.get<unknown>(WANT_SEE_PREFERENCES_KEY)
      preferences.value = normalizeWantSeePreferences(saved)
    } finally {
      initialized.value = true
    }
  }

  function setPreferences(
    displayMode: WantSeeDisplayMode,
    includePendingSale: boolean,
  ): void {
    preferences.value = {
      displayMode,
      includePendingSale,
    }
    void persist()
  }

  function reset(): void {
    setPreferences(
      DEFAULT_WANT_SEE_PREFERENCES.displayMode,
      DEFAULT_WANT_SEE_PREFERENCES.includePendingSale,
    )
  }

  async function persist(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      await repositories.settings.set(WANT_SEE_PREFERENCES_KEY, { ...preferences.value })
    } catch {
      // Keep the current session usable if settings persistence is temporarily unavailable.
    }
  }

  return {
    displayMode,
    includePendingSale,
    initialized,
    initialize,
    reset,
    setPreferences,
  }
})
