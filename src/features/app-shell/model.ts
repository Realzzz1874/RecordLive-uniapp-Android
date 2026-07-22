export type AppTabId = 'records' | 'want-see' | 'imprints' | 'settings'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export interface AppTabDefinition {
  id: AppTabId
  label: string
  icon:
    | 'music.note.house.fill'
    | 'heart.text.square.fill'
    | 'lasso.badge.sparkles'
    | 'gear'
}

export const APP_TABS: readonly AppTabDefinition[] = [
  { id: 'records', label: '记录现场', icon: 'music.note.house.fill' },
  { id: 'want-see', label: '待观看', icon: 'heart.text.square.fill' },
  { id: 'imprints', label: '印记', icon: 'lasso.badge.sparkles' },
  { id: 'settings', label: '设置', icon: 'gear' },
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
