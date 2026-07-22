<script setup lang="ts">
import { ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import {
  DEFAULT_WANT_SEE_PREFERENCES,
  type WantSeeDisplayMode,
} from '@/features/want-see/model'

const props = defineProps<{
  visible: boolean
  displayMode: WantSeeDisplayMode
  includePendingSale: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [displayMode: WantSeeDisplayMode, includePendingSale: boolean]
}>()

const displayModeDraft = ref<WantSeeDisplayMode>(props.displayMode)
const includePendingSaleDraft = ref(props.includePendingSale)

watch(
  () => [props.visible, props.displayMode, props.includePendingSale] as const,
  ([visible]) => {
    if (!visible) return
    displayModeDraft.value = props.displayMode
    includePendingSaleDraft.value = props.includePendingSale
  },
)

function reset(): void {
  displayModeDraft.value = DEFAULT_WANT_SEE_PREFERENCES.displayMode
  includePendingSaleDraft.value = DEFAULT_WANT_SEE_PREFERENCES.includePendingSale
}

function apply(): void {
  emit('apply', displayModeDraft.value, includePendingSaleDraft.value)
  emit('close')
}
</script>

<template>
  <view v-if="visible" class="filter-layer">
    <button class="filter-scrim" aria-label="关闭筛选" @tap="$emit('close')" />
    <view class="filter-sheet" aria-label="待观看筛选面板">
      <view class="filter-header">
        <view>
          <text class="filter-header__title">筛选与显示</text>
          <text class="filter-header__subtitle">仅影响待观看页面</text>
        </view>
        <button class="close-button" aria-label="关闭筛选" @tap="$emit('close')">
          <AppIcon name="close" />
        </button>
      </view>

      <view class="filter-content">
        <view class="filter-section">
          <text class="filter-section__title">展示方式</text>
          <view class="display-options" aria-label="展示方式">
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'card' }"
              aria-label="演出卡片1展示"
              @tap="displayModeDraft = 'card'"
            >
              <AppIcon name="image" />
              <text>演出卡片1</text>
            </button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'simple' }"
              aria-label="演出卡片2展示"
              @tap="displayModeDraft = 'simple'"
            >
              <AppIcon name="list" />
              <text>演出卡片2</text>
            </button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'timeline' }"
              aria-label="文字时间线展示"
              @tap="displayModeDraft = 'timeline'"
            >
              <AppIcon name="calendar" />
              <text>文字时间线</text>
            </button>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__title">状态</text>
          <button
            class="filter-chip"
            :class="{ 'filter-chip--selected': includePendingSaleDraft }"
            aria-label="包含待开票演出"
            @tap="includePendingSaleDraft = !includePendingSaleDraft"
          >待开票</button>
        </view>
      </view>

      <view class="filter-actions">
        <button class="reset-button" @tap="reset">恢复默认</button>
        <button class="apply-button" @tap="apply">应用</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.filter-layer { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; }
.filter-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15,10,8,.5); }
.filter-scrim::after, .close-button::after, .filter-chip::after, .display-option::after, .reset-button::after, .apply-button::after { border: 0; }
.filter-sheet { position: relative; z-index: 1; box-sizing: border-box; width: 100%; overflow: hidden; border-radius: 30rpx 30rpx 0 0; background: var(--color-background); box-shadow: 0 -18rpx 60rpx rgba(0,0,0,.2); }
.filter-header { display: flex; min-height: 122rpx; padding: 28rpx 30rpx 22rpx 36rpx; align-items: center; justify-content: space-between; border-bottom: var(--app-border-width) solid var(--color-border); }
.filter-header__title { display: block; color: var(--color-text); font-size: 34rpx; font-weight: 720; }
.filter-header__subtitle { display: block; margin-top: 7rpx; color: var(--color-muted); font-size: 21rpx; }
.close-button { width: 66rpx; height: 66rpx; margin: 0; padding: 18rpx; border: 0; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); }
.filter-content { box-sizing: border-box; }
.filter-section { padding: 28rpx 36rpx; border-bottom: var(--app-border-width) solid var(--color-border-subtle); }
.filter-section__title { display: block; margin-bottom: 18rpx; color: var(--color-muted); font-size: 23rpx; font-weight: 620; }
.display-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.display-option { display: flex; min-width: 0; height: 78rpx; margin: 0; padding: 0 15rpx; align-items: center; justify-content: center; gap: 10rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); color: var(--color-muted); font-size: 23rpx; font-weight: 620; }
.display-option > :first-child { width: 31rpx; height: 31rpx; }
.display-option text { min-width: 0; white-space: nowrap; }
.display-option--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); }
.filter-chip { min-height: 62rpx; margin: 0; padding: 0 22rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 31rpx; background: var(--color-surface); color: var(--color-muted); font-size: 24rpx; line-height: 60rpx; }
.filter-chip--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); font-weight: 620; }
.filter-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 16rpx; padding: 18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: var(--app-border-width) solid var(--color-border); }
.reset-button, .apply-button { height: 82rpx; margin: 0; border-radius: 18rpx; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.reset-button { border: var(--app-border-width) solid var(--color-border); background: var(--color-surface); color: var(--color-muted); }
.apply-button { border: 0; background: var(--color-accent); color: var(--color-on-accent); }
</style>
