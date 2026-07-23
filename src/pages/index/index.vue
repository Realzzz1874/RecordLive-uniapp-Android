<script setup lang="ts">
import { onBackPress, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

import BottomTabBar from '@/components/BottomTabBar.vue'
import { getBackDestination, type ThemePreference } from '@/features/app-shell/model'
import ImprintsScreen from '@/features/imprints/ImprintsScreen.vue'
import ArtistDetailScreen from '@/features/performances/ArtistDetailScreen.vue'
import PerformanceDetailScreen from '@/features/performances/PerformanceDetailScreen.vue'
import RecordsScreen from '@/features/performances/RecordsScreen.vue'
import PerformanceEditorScreen from '@/features/performances/PerformanceEditorScreen.vue'
import PlayDetailScreen from '@/features/performances/PlayDetailScreen.vue'
import type { Performance } from '@/domain/performance'
import ReferenceDataScreen from '@/features/reference-data/ReferenceDataScreen.vue'
import QuickAddSettingsScreen from '@/features/settings/QuickAddSettingsScreen.vue'
import SettingsScreen from '@/features/settings/SettingsScreen.vue'
// #ifdef APP-PLUS
import BackupScreen from '@/features/backup/BackupScreen.vue'
// #endif
import WantSeeScreen from '@/features/want-see/WantSeeScreen.vue'
import {
  PERFORMANCE_DISPLAY_MODE_LABELS,
  type PerformanceDisplayMode,
} from '@/features/preferences/model'
import { useAppShellStore } from '@/stores/app-shell'
import { useBrowsePreferencesStore } from '@/stores/browse-preferences'
import { useQuickAddPreferencesStore } from '@/stores/quick-add-preferences'
import { useWantSeePreferencesStore } from '@/stores/want-see-preferences'
import { useImprintPreferencesStore } from '@/stores/imprint-preferences'

const appShellStore = useAppShellStore()
const browsePreferencesStore = useBrowsePreferencesStore()
const quickAddPreferencesStore = useQuickAddPreferencesStore()
const wantSeePreferencesStore = useWantSeePreferencesStore()
const imprintPreferencesStore = useImprintPreferencesStore()
const { activeTab, resolvedTheme, themePreference } = storeToRefs(appShellStore)
const { displayMode } = storeToRefs(browsePreferencesStore)
const settingsDestination = ref<'root' | 'category' | 'tag' | 'quick-add' | 'backup'>('root')
const recordsDestination = ref<'root' | 'artist' | 'play' | 'detail' | 'editor'>('root')
const recordsRefreshKey = ref(0)
const selectedPerformanceId = ref('')
const selectedArtistName = ref('')
const selectedPlayName = ref('')
const statisticsScopeIds = ref<string[] | null>(null)
const performanceDetailReturnDestination = ref<'root' | 'artist' | 'play'>('root')
const editorPerformanceId = ref<string | undefined>()
const editorReturnDestination = ref<'root' | 'detail'>('root')
const editorInitialStartedAtMs = ref<number | undefined>()
const systemInfo = uni.getSystemInfoSync()
const appStatusBarHeight = Math.max(0, systemInfo.statusBarHeight ?? 0)
const appShellStyle: Record<string, string> = {
  '--app-status-bar-height': `${appStatusBarHeight}px`,
}

if (systemInfo.uniPlatform === 'app') {
  appShellStyle['--app-border-width'] = '1px'
}

function synchronizeSystemTheme(): void {
  appShellStore.initialize()
  void browsePreferencesStore.initialize()
  void quickAddPreferencesStore.initialize()
}

function showPlannedAction(message: string): void {
  uni.showToast({
    title: message,
    icon: 'none',
    duration: 1800,
  })
}

function selectTheme(): void {
  const preferences: readonly ThemePreference[] = ['system', 'light', 'dark']

  uni.showActionSheet({
    title: '主题与显示',
    itemList: ['跟随系统', '浅色', '深色'],
    success: ({ tapIndex }) => {
      const preference = preferences[tapIndex]
      if (preference) {
        appShellStore.setThemePreference(preference)
      }
    },
  })
}

function selectDisplayMode(): void {
  const modes = Object.keys(PERFORMANCE_DISPLAY_MODE_LABELS) as PerformanceDisplayMode[]
  uni.showActionSheet({
    title: '默认展示方式',
    itemList: modes.map((mode) => PERFORMANCE_DISPLAY_MODE_LABELS[mode]),
    success: ({ tapIndex }) => {
      const mode = modes[tapIndex]
      if (mode) browsePreferencesStore.setDisplayMode(mode)
    },
  })
}

function selectTab(tab: Parameters<typeof appShellStore.setActiveTab>[0]): void {
  settingsDestination.value = 'root'
  recordsDestination.value = 'root'
  appShellStore.setActiveTab(tab)
}

function openPerformanceEditor(fromWantSee = false): void {
  editorPerformanceId.value = undefined
  editorInitialStartedAtMs.value = fromWantSee ? nextEveningTimestamp() : undefined
  editorReturnDestination.value = 'root'
  recordsDestination.value = 'editor'
}

function openPerformanceEditorForDate(initialStartedAtMs: number): void {
  editorPerformanceId.value = undefined
  editorInitialStartedAtMs.value = initialStartedAtMs
  editorReturnDestination.value = 'root'
  recordsDestination.value = 'editor'
}

function closePerformanceEditor(): void {
  recordsDestination.value = editorReturnDestination.value
}

function openPerformanceDetail(id: string, returnDestination: 'root' | 'artist' | 'play' = 'root'): void {
  selectedPerformanceId.value = id
  performanceDetailReturnDestination.value = returnDestination
  recordsDestination.value = 'detail'
}

function closePerformanceDetail(): void {
  recordsDestination.value = performanceDetailReturnDestination.value
}

function openArtistDetail(name: string, performanceIds?: string[]): void {
  selectedArtistName.value = name
  statisticsScopeIds.value = performanceIds ? [...performanceIds] : null
  recordsDestination.value = 'artist'
}

function closeArtistDetail(): void {
  recordsDestination.value = 'root'
}

function openArtistPerformance(id: string): void {
  openPerformanceDetail(id, 'artist')
}

function openPlayDetail(name: string, performanceIds?: string[]): void {
  selectedPlayName.value = name
  statisticsScopeIds.value = performanceIds ? [...performanceIds] : null
  recordsDestination.value = 'play'
}

function closePlayDetail(): void {
  recordsDestination.value = 'root'
}

function openPlayPerformance(id: string): void {
  openPerformanceDetail(id, 'play')
}

function editPerformance(id: string): void {
  selectedPerformanceId.value = id
  editorPerformanceId.value = id
  editorInitialStartedAtMs.value = undefined
  editorReturnDestination.value = 'detail'
  recordsDestination.value = 'editor'
}

function handlePerformanceSaved(performance: Performance): void {
  selectedPerformanceId.value = performance.id
  recordsRefreshKey.value += 1
  closePerformanceEditor()
}

function handlePerformanceDeleted(): void {
  selectedPerformanceId.value = ''
  recordsDestination.value = performanceDetailReturnDestination.value
  recordsRefreshKey.value += 1
}

function openReferenceData(kind: 'category' | 'tag'): void {
  settingsDestination.value = kind
}

function openQuickAddSettings(): void {
  settingsDestination.value = 'quick-add'
}

function openBackup(): void {
  settingsDestination.value = 'backup'
}

async function handleBackupRestored(): Promise<void> {
  await Promise.all([
    appShellStore.initialize(),
    browsePreferencesStore.reload(),
    quickAddPreferencesStore.reload(),
    wantSeePreferencesStore.reload(),
    imprintPreferencesStore.reload(),
  ])
  settingsDestination.value = 'root'
  recordsDestination.value = 'root'
  recordsRefreshKey.value += 1
  appShellStore.setActiveTab('records')
}

function closeReferenceData(): void {
  settingsDestination.value = 'root'
}

onShow(synchronizeSystemTheme)

onBackPress(() => {
  if (isPerformanceTab(activeTab.value) && recordsDestination.value === 'editor') {
    closePerformanceEditor()
    return true
  }

  if (isPerformanceTab(activeTab.value) && recordsDestination.value === 'detail') {
    closePerformanceDetail()
    return true
  }

  if ((activeTab.value === 'records' || activeTab.value === 'imprints') && recordsDestination.value === 'artist') {
    closeArtistDetail()
    return true
  }

  if ((activeTab.value === 'records' || activeTab.value === 'imprints') && recordsDestination.value === 'play') {
    closePlayDetail()
    return true
  }

  if (activeTab.value === 'settings' && settingsDestination.value !== 'root') {
    closeReferenceData()
    return true
  }

  const destination = getBackDestination(activeTab.value)
  if (!destination) {
    return false
  }

  appShellStore.setActiveTab(destination)
  return true
})

function nextEveningTimestamp(): number {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(19, 30, 0, 0)
  return date.getTime()
}

function isPerformanceTab(tab: typeof activeTab.value): boolean {
  return tab === 'records' || tab === 'want-see' || tab === 'imprints'
}

watch(
  resolvedTheme,
  (theme) => {
    uni.setNavigationBarColor({
      frontColor: theme === 'dark' ? '#ffffff' : '#000000',
      backgroundColor: theme === 'dark' ? '#171311' : '#ffffff',
      animation: {
        duration: 160,
        timingFunc: 'easeIn',
      },
    })
  },
  { immediate: true },
)
</script>

<template>
  <view class="app-shell" :class="`theme-${resolvedTheme}`" :style="appShellStyle">
    <main class="app-shell__content">
      <PerformanceDetailScreen
        v-if="(activeTab === 'records' || activeTab === 'want-see' || activeTab === 'imprints') && recordsDestination === 'detail'"
        :performance-id="selectedPerformanceId"
        @back="closePerformanceDetail"
        @edit="editPerformance"
        @deleted="handlePerformanceDeleted"
      />
      <PerformanceEditorScreen
        v-else-if="(activeTab === 'records' || activeTab === 'want-see' || activeTab === 'imprints') && recordsDestination === 'editor'"
        :performance-id="editorPerformanceId"
        :initial-started-at-ms="editorInitialStartedAtMs"
        @back="closePerformanceEditor"
        @saved="handlePerformanceSaved"
      />
      <ArtistDetailScreen
        v-else-if="(activeTab === 'records' || activeTab === 'imprints') && recordsDestination === 'artist'"
        :artist-name="selectedArtistName"
        :refresh-key="recordsRefreshKey"
        :performance-ids="statisticsScopeIds"
        @back="closeArtistDetail"
        @open="openArtistPerformance"
      />
      <PlayDetailScreen
        v-else-if="(activeTab === 'records' || activeTab === 'imprints') && recordsDestination === 'play'"
        :play-name="selectedPlayName"
        :refresh-key="recordsRefreshKey"
        :performance-ids="statisticsScopeIds"
        @back="closePlayDetail"
        @open="openPlayPerformance"
      />
      <RecordsScreen
        v-else-if="activeTab === 'records'"
        :theme="resolvedTheme"
        :refresh-key="recordsRefreshKey"
        @add="openPerformanceEditor"
        @open="openPerformanceDetail"
        @open-artist="openArtistDetail"
        @open-play="openPlayDetail"
      />
      <WantSeeScreen
        v-else-if="activeTab === 'want-see'"
        :theme="resolvedTheme"
        :refresh-key="recordsRefreshKey"
        @add="openPerformanceEditor(true)"
        @open="openPerformanceDetail"
      />
      <ImprintsScreen
        v-else-if="activeTab === 'imprints'"
        :theme="resolvedTheme"
        :refresh-key="recordsRefreshKey"
        @add="openPerformanceEditorForDate"
        @open="openPerformanceDetail"
        @open-artist="openArtistDetail"
        @open-play="openPlayDetail"
      />
      <template v-else>
        <SettingsScreen
          v-if="settingsDestination === 'root'"
          :theme-preference="themePreference"
          :display-mode="displayMode"
          @select-theme="selectTheme"
          @select-display-mode="selectDisplayMode"
          @planned-action="showPlannedAction"
          @open-categories="openReferenceData('category')"
          @open-tags="openReferenceData('tag')"
          @open-quick-add-settings="openQuickAddSettings"
          @open-backup="openBackup"
        />
        <!-- #ifdef APP-PLUS -->
        <BackupScreen
          v-else-if="settingsDestination === 'backup'"
          @back="closeReferenceData"
          @restored="handleBackupRestored"
        />
        <!-- #endif -->
        <QuickAddSettingsScreen
          v-else-if="settingsDestination === 'quick-add'"
          @back="closeReferenceData"
        />
        <ReferenceDataScreen
          v-else
          :kind="settingsDestination"
          @back="closeReferenceData"
        />
      </template>
    </main>

    <BottomTabBar
      v-if="recordsDestination === 'root' && (activeTab !== 'settings' || settingsDestination === 'root')"
      :active-tab="activeTab"
      @select="selectTab"
    />
  </view>
</template>

<style scoped>
.app-shell {
  --app-border-width: 1rpx;
  --app-header-bar-height: 96rpx;
  --app-header-height: calc(var(--app-status-bar-height, 0px) + var(--app-header-bar-height));
  --color-background: #ffffff;
  --color-surface: #ffffff;
  --color-secondary-surface: rgba(242, 242, 247, 0.6);
  --color-text: #1b1715;
  --color-muted: #6f6965;
  --color-border: #ded7d2;
  --color-border-subtle: #e8e2de;
  --color-accent: #a74f17;
  --color-accent-pressed: #843b10;
  --color-accent-border: #8f4215;
  --color-accent-soft: #f7eee8;
  --color-on-accent: #ffffff;
  --color-tab-idle: #676561;
  --color-tab-background: rgba(255, 255, 255, 0.98);
  --color-tab-shadow: rgba(45, 31, 22, 0.05);
  --color-row-pressed: #f8f3ef;
  --color-illustration-line: #9e480f;
  --color-illustration-detail: #b88059;
  --color-illustration-paper: #fffdfb;
  --color-illustration-shadow: #f1e4da;
  --color-illustration-dot: #e7c4a7;
  --color-illustration-grid: #f3ebe5;
  --color-illustration-grid-line: #e7d6ca;

  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-text);
  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.app-shell.theme-dark {
  --color-background: #171311;
  --color-surface: #211c19;
  --color-secondary-surface: rgba(28, 28, 30, 0.6);
  --color-text: #f8f2ee;
  --color-muted: #b7aaa3;
  --color-border: #39312d;
  --color-border-subtle: #342d29;
  --color-accent: #d6783f;
  --color-accent-pressed: #b85c27;
  --color-accent-border: #db8652;
  --color-accent-soft: #2c211b;
  --color-on-accent: #fff8f3;
  --color-tab-idle: #b6aaa4;
  --color-tab-background: rgba(28, 23, 20, 0.98);
  --color-tab-shadow: rgba(0, 0, 0, 0.18);
  --color-row-pressed: #29221e;
  --color-illustration-line: #d8824e;
  --color-illustration-detail: #8f7770;
  --color-illustration-paper: #211c19;
  --color-illustration-shadow: #271e1a;
  --color-illustration-dot: #756159;
  --color-illustration-grid: #2b2420;
  --color-illustration-grid-line: #463a34;
}

.app-shell__content {
  display: block;
  min-height: 100vh;
  padding: 0;
}

@media (min-width: 600px) {
  .app-shell {
    width: min(100%, 560px);
    box-shadow: 0 0 80px rgba(45, 31, 22, 0.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell {
    transition: none;
  }
}
</style>
