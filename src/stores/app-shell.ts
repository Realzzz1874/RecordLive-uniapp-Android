import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  isThemePreference,
  resolveTheme,
  type AppTabId,
  type ResolvedTheme,
  type ThemePreference,
} from '@/features/app-shell/model'

const THEME_STORAGE_KEY = 'recordlive.theme-preference'

function readSystemTheme(): ResolvedTheme {
  try {
    return uni.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const useAppShellStore = defineStore('app-shell', () => {
  const activeTab = ref<AppTabId>('records')
  const themePreference = ref<ThemePreference>('system')
  const systemTheme = ref<ResolvedTheme>('light')
  const initialized = ref(false)

  const resolvedTheme = computed(() =>
    resolveTheme(themePreference.value, systemTheme.value),
  )

  function initialize(): void {
    systemTheme.value = readSystemTheme()

    try {
      const savedPreference: unknown = uni.getStorageSync(THEME_STORAGE_KEY)
      if (isThemePreference(savedPreference)) {
        themePreference.value = savedPreference
      }
    } catch {
      // Storage is an enhancement for H5 previews; the app remains usable without it.
    }

    initialized.value = true
  }

  function setActiveTab(tab: AppTabId): void {
    activeTab.value = tab
  }

  function setThemePreference(preference: ThemePreference): void {
    themePreference.value = preference

    try {
      uni.setStorageSync(THEME_STORAGE_KEY, preference)
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  function setSystemTheme(theme: ResolvedTheme): void {
    systemTheme.value = theme
  }

  return {
    activeTab,
    initialized,
    resolvedTheme,
    systemTheme,
    themePreference,
    initialize,
    setActiveTab,
    setSystemTheme,
    setThemePreference,
  }
})
