import { describe, expect, it } from 'vitest'

import {
  APP_TABS,
  getBackDestination,
  isThemePreference,
  resolveTheme,
} from '../src/features/app-shell/model'

describe('Milestone 1 app shell', () => {
  it('keeps the four Android tabs in the approved order', () => {
    expect(APP_TABS.map(({ id, label, icon }) => ({ id, label, icon }))).toEqual([
      { id: 'records', label: '记录现场', icon: 'ticket' },
      { id: 'want-see', label: '待观看', icon: 'bookmark' },
      { id: 'imprints', label: '印记', icon: 'calendar' },
      { id: 'settings', label: '设置', icon: 'settings' },
    ])
    expect(new Set(APP_TABS.map((tab) => tab.id)).size).toBe(APP_TABS.length)
  })

  it('returns secondary tabs to records on Android back', () => {
    expect(getBackDestination('want-see')).toBe('records')
    expect(getBackDestination('imprints')).toBe('records')
    expect(getBackDestination('settings')).toBe('records')
    expect(getBackDestination('records')).toBeNull()
  })

  it('resolves system, light and dark theme preferences', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')

    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('ios')).toBe(false)
  })
})
