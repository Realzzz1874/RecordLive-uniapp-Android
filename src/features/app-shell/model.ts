export type AppTabId = 'records' | 'want-see' | 'imprints' | 'settings'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export interface AppTabDefinition {
  id: AppTabId
  label: string
  icon: 'ticket' | 'bookmark' | 'calendar' | 'settings'
}

export const APP_TABS: readonly AppTabDefinition[] = [
  { id: 'records', label: '记录现场', icon: 'ticket' },
  { id: 'want-see', label: '待看', icon: 'bookmark' },
  { id: 'imprints', label: '印记', icon: 'calendar' },
  { id: 'settings', label: '设置', icon: 'settings' },
] as const

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference
}

export function getBackDestination(activeTab: AppTabId): AppTabId | null {
  return activeTab === 'records' ? null : 'records'
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}
