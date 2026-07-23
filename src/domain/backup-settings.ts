import type { BackupSettingKey } from './backup'
import { isThemePreference } from '@/features/app-shell/model'
import { normalizeImprintPreferences } from '@/features/imprints/model'
import { normalizeBrowsePreferences } from '@/features/preferences/model'
import { normalizeQuickAddPreferences } from '@/features/preferences/quick-add'
import { normalizeCompanyNames } from '@/features/performances/company-names'
import { normalizeFriends } from '@/features/performances/friends'
import { normalizePurchaseChannels } from '@/features/performances/purchase-channels'
import { normalizeWantSeePreferences } from '@/features/want-see/model'

export function normalizeBackupSettingValue(key: BackupSettingKey, value: unknown): unknown {
  switch (key) {
    case 'performance-browse-preferences-v1':
      return normalizeBrowsePreferences(value)
    case 'want-see-preferences-v1':
      return normalizeWantSeePreferences(value)
    case 'imprint-preferences-v1':
      return normalizeImprintPreferences(value)
    case 'quick-add-preferences-v1':
      return normalizeQuickAddPreferences(value)
    case 'recordlive.theme-preference':
      return isThemePreference(value) ? value : 'system'
    case 'recordlive.purchase-channels.v1':
      return normalizePurchaseChannels(value)
    case 'recordlive.friends.v1':
      return normalizeFriends(value)
    case 'recordlive.custom-companies.v1':
      return normalizeCompanyNames(value)
  }
}
