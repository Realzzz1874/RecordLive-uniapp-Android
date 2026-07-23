<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from '@/components/AppHeader.vue'
import { useQuickAddPreferencesStore } from '@/stores/quick-add-preferences'

interface SwitchChangeEvent {
  detail: { value: boolean }
}

defineEmits<{
  back: []
}>()

const quickAddPreferencesStore = useQuickAddPreferencesStore()
const {
  copyExisting,
  parseLink,
  chineseMusicalSchedule,
  koreanMusicalSchedule,
} = storeToRefs(quickAddPreferencesStore)

onMounted(() => {
  void quickAddPreferencesStore.initialize()
})

function updateCopyExisting(event: Event): void {
  const detail = (event as unknown as SwitchChangeEvent).detail
  quickAddPreferencesStore.setCopyExisting(Boolean(detail.value))
}

function updateParseLink(event: Event): void {
  const detail = (event as unknown as SwitchChangeEvent).detail
  quickAddPreferencesStore.setParseLink(Boolean(detail.value))
}

function updateChineseMusicalSchedule(event: Event): void {
  const detail = (event as unknown as SwitchChangeEvent).detail
  quickAddPreferencesStore.setChineseMusicalSchedule(Boolean(detail.value))
}

function updateKoreanMusicalSchedule(event: Event): void {
  const detail = (event as unknown as SwitchChangeEvent).detail
  quickAddPreferencesStore.setKoreanMusicalSchedule(Boolean(detail.value))
}
</script>

<template>
  <view class="quick-add-settings-screen">
    <AppHeader title="快速添加" show-back @back="$emit('back')" />

    <scroll-view class="settings-content" scroll-y>
      <view class="settings-section">
        <text class="settings-section__title">快速添加方式</text>
        <view class="settings-row">
          <view class="settings-row__copy">
            <text class="settings-row__label">复制已有演出</text>
            <text class="settings-row__supporting">从历史演出中选择字段填入添加页面</text>
          </view>
          <switch
            :checked="copyExisting"
            aria-label="启用复制已有演出"
            color="#a74f17"
            @change="updateCopyExisting"
          />
        </view>
        <view class="settings-row settings-row--separated">
          <view class="settings-row__copy">
            <text class="settings-row__label">解析链接</text>
            <!-- <text class="settings-row__supporting">当前支持：大麦、猫眼</text> -->
          </view>
          <switch
            :checked="parseLink"
            aria-label="启用解析链接"
            color="#a74f17"
            @change="updateParseLink"
          />
        </view>
        <view class="settings-row settings-row--separated">
          <view class="settings-row__copy">
            <text class="settings-row__label">中文音乐剧排期</text>
            <text class="settings-row__supporting">数据源：y.saoju.net</text>
          </view>
          <switch
            :checked="chineseMusicalSchedule"
            aria-label="启用中文音乐剧排期"
            color="#a74f17"
            @change="updateChineseMusicalSchedule"
          />
        </view>
        <view class="settings-row settings-row--separated">
          <view class="settings-row__copy">
            <text class="settings-row__label">韩国音乐剧排期</text>
            <!-- <text class="settings-row__supporting">数据源：myukit.com</text> -->
          </view>
          <switch
            :checked="koreanMusicalSchedule"
            aria-label="启用韩国音乐剧排期"
            color="#a74f17"
            @change="updateKoreanMusicalSchedule"
          />
        </view>
      </view>

      <text class="settings-note">可分别控制添加演出页中显示的快速添加方式。</text>
    </scroll-view>
  </view>
</template>

<style scoped>
.quick-add-settings-screen { min-height: 100vh; background: var(--color-background); color: var(--color-text); }
.settings-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding-bottom: calc(56rpx + env(safe-area-inset-bottom)); }
.settings-section { padding-top: 46rpx; border-bottom: var(--app-border-width) solid var(--color-border); }
.settings-section__title { display: block; padding: 0 34rpx 20rpx; color: var(--color-accent); font-size: 27rpx; font-weight: 650; }
.settings-row { display: flex; min-height: 126rpx; padding: 0 34rpx 0 38rpx; align-items: center; gap: 24rpx; }
.settings-row--separated { border-top: var(--app-border-width) solid var(--color-border-subtle); }
.settings-row__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 7rpx; }
.settings-row__label { color: var(--color-text); font-size: 29rpx; font-weight: 550; line-height: 1.35; }
.settings-row__supporting { color: var(--color-muted); font-size: 22rpx; line-height: 1.4; }
.settings-note { display: block; padding: 24rpx 38rpx; color: var(--color-muted); font-size: 22rpx; line-height: 1.55; }
</style>
