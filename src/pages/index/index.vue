<script setup lang="ts">
import { onBackPress, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import BottomTabBar from '@/components/BottomTabBar.vue'
import { getBackDestination, type ThemePreference } from '@/features/app-shell/model'
import ImprintsScreen from '@/features/imprints/ImprintsScreen.vue'
import RecordsScreen from '@/features/performances/RecordsScreen.vue'
import SettingsScreen from '@/features/settings/SettingsScreen.vue'
import WantSeeScreen from '@/features/want-see/WantSeeScreen.vue'
import { useAppShellStore } from '@/stores/app-shell'

const appShellStore = useAppShellStore()
const { activeTab, resolvedTheme, themePreference } = storeToRefs(appShellStore)

function synchronizeSystemTheme(): void {
  appShellStore.initialize()
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

function showAbout(): void {
  uni.showModal({
    title: '关于记录现场',
    content: '为喜欢的现场演出留下时间、票根与回忆。\nAndroid 版本 0.1.0',
    showCancel: false,
    confirmText: '知道了',
  })
}

onShow(synchronizeSystemTheme)

onBackPress(() => {
  const destination = getBackDestination(activeTab.value)
  if (!destination) {
    return false
  }

  appShellStore.setActiveTab(destination)
  return true
})

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
  <view class="app-shell" :class="`theme-${resolvedTheme}`">
    <main class="app-shell__content">
      <RecordsScreen
        v-if="activeTab === 'records'"
        :theme="resolvedTheme"
        @planned-action="showPlannedAction"
      />
      <WantSeeScreen
        v-else-if="activeTab === 'want-see'"
        @planned-action="showPlannedAction"
      />
      <ImprintsScreen
        v-else-if="activeTab === 'imprints'"
        @planned-action="showPlannedAction"
      />
      <SettingsScreen
        v-else
        :theme-preference="themePreference"
        @select-theme="selectTheme"
        @planned-action="showPlannedAction"
        @show-about="showAbout"
      />
    </main>

    <BottomTabBar
      :active-tab="activeTab"
      @select="appShellStore.setActiveTab"
    />
  </view>
</template>

<style scoped>
.app-shell {
  --color-background: #ffffff;
  --color-surface: #ffffff;
  --color-text: #1b1715;
  --color-muted: #6f6965;
  --color-border: #e9e4e0;
  --color-border-subtle: #eeeae7;
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
