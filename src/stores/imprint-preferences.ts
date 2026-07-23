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

export type ImprintSection = 'month' | 'year' | 'ranks'
export type ImprintRankView =
  | 'overview'
  | 'artist-times'
  | 'artist-expense'
  | 'play-times'
  | 'play-expense'

export const useImprintPreferencesStore = defineStore('imprint-preferences', () => {
  const preferences = ref(cloneImprintPreferences(DEFAULT_IMPRINT_PREFERENCES))
  const activeSection = ref<ImprintSection>('month')
  const rankView = ref<ImprintRankView>('overview')
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  const filter = computed(() => preferences.value.filter)
  const alwaysShowDate = computed(() => preferences.value.alwaysShowDate)
  const showPerformanceTime = computed(() => preferences.value.showPerformanceTime)
  const showExpenseAmounts = computed(() => preferences.value.showExpenseAmounts)

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
    nextShowExpenseAmounts = preferences.value.showExpenseAmounts,
  ): void {
    preferences.value = normalizeImprintPreferences({
      filter: nextFilter,
      alwaysShowDate: nextAlwaysShowDate,
      showPerformanceTime: nextShowPerformanceTime,
      showExpenseAmounts: nextShowExpenseAmounts,
    })
    void persist()
  }

  function setShowExpenseAmounts(value: boolean): void {
    preferences.value = normalizeImprintPreferences({
      ...cloneImprintPreferences(preferences.value),
      showExpenseAmounts: value,
    })
    void persist()
  }

  function setActiveSection(value: ImprintSection): void {
    activeSection.value = value
  }

  function setRankView(value: ImprintRankView): void {
    rankView.value = value
  }

  function reset(): void {
    const defaults = cloneImprintPreferences(DEFAULT_IMPRINT_PREFERENCES)
    setPreferences(
      defaults.filter,
      defaults.alwaysShowDate,
      defaults.showPerformanceTime,
      defaults.showExpenseAmounts,
    )
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
    showExpenseAmounts,
    activeSection,
    rankView,
    initialized,
    initialize,
    reset,
    setActiveSection,
    setRankView,
    setPreferences,
    setShowExpenseAmounts,
  }
})
