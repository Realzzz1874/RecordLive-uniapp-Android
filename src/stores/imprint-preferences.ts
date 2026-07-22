import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  cloneImprintPreferences,
  DEFAULT_IMPRINT_PREFERENCES,
  normalizeImprintPreferences,
  type ImprintFilter,
} from '@/features/imprints/model'
import { getAppRepositories } from '@/platform/repositories/context'

const IMPRINT_PREFERENCES_KEY = 'imprint-preferences-v1'

export const useImprintPreferencesStore = defineStore('imprint-preferences', () => {
  const preferences = ref(cloneImprintPreferences(DEFAULT_IMPRINT_PREFERENCES))
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  const filter = computed(() => preferences.value.filter)
  const alwaysShowDate = computed(() => preferences.value.alwaysShowDate)
  const showPerformanceTime = computed(() => preferences.value.showPerformanceTime)

  function initialize(): Promise<void> {
    initialization ??= load()
    return initialization
  }

  async function load(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      const saved = await repositories.settings.get<unknown>(IMPRINT_PREFERENCES_KEY)
      preferences.value = normalizeImprintPreferences(saved)
    } finally {
      initialized.value = true
    }
  }

  function setPreferences(
    nextFilter: ImprintFilter,
    nextAlwaysShowDate: boolean,
    nextShowPerformanceTime: boolean,
  ): void {
    preferences.value = normalizeImprintPreferences({
      filter: nextFilter,
      alwaysShowDate: nextAlwaysShowDate,
      showPerformanceTime: nextShowPerformanceTime,
    })
    void persist()
  }

  function reset(): void {
    const defaults = cloneImprintPreferences(DEFAULT_IMPRINT_PREFERENCES)
    setPreferences(defaults.filter, defaults.alwaysShowDate, defaults.showPerformanceTime)
  }

  async function persist(): Promise<void> {
    try {
      const repositories = await getAppRepositories()
      await repositories.settings.set(
        IMPRINT_PREFERENCES_KEY,
        cloneImprintPreferences(preferences.value),
      )
    } catch {
      // Keep the current session usable if settings persistence is temporarily unavailable.
    }
  }

  return {
    filter,
    alwaysShowDate,
    showPerformanceTime,
    initialized,
    initialize,
    reset,
    setPreferences,
  }
})
