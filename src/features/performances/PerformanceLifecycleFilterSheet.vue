<script setup lang="ts">
import { ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import type { PerformanceLifecycle } from '@/domain/performance'
import {
  ALL_PERFORMANCE_LIFECYCLES,
  PERFORMANCE_LIFECYCLE_OPTIONS,
} from '@/features/preferences/model'

const props = defineProps<{
  visible: boolean
  lifecycles: readonly PerformanceLifecycle[]
}>()

const emit = defineEmits<{
  close: []
  apply: [lifecycles: PerformanceLifecycle[]]
}>()

const draft = ref<PerformanceLifecycle[]>([...props.lifecycles])

watch(
  () => [props.visible, props.lifecycles] as const,
  ([visible]) => {
    if (visible) draft.value = [...props.lifecycles]
  },
  { deep: true },
)

function toggleLifecycle(value: PerformanceLifecycle): void {
  draft.value = draft.value.includes(value)
    ? draft.value.filter((item) => item !== value)
    : [...draft.value, value]
}

function reset(): void {
  draft.value = [...ALL_PERFORMANCE_LIFECYCLES]
}

function apply(): void {
  emit('apply', [...draft.value])
  emit('close')
}
</script>

<template>
  <view v-if="visible" class="filter-layer">
    <button class="filter-scrim" aria-label="关闭演出状态筛选" @tap="$emit('close')" />
    <view class="filter-sheet" aria-label="演出状态筛选面板">
      <view class="filter-header">
        <view>
          <text class="filter-header__title">筛选演出状态</text>
          <text class="filter-header__subtitle">状态选择与首页同步</text>
        </view>
        <button class="close-button" aria-label="关闭演出状态筛选" @tap="$emit('close')">
          <AppIcon name="close" />
        </button>
      </view>

      <view class="filter-section">
        <text class="filter-section__title">状态</text>
        <view class="chip-list" aria-label="按状态筛选演出">
          <button
            v-for="option in PERFORMANCE_LIFECYCLE_OPTIONS"
            :key="option.value"
            class="filter-chip"
            :class="{ 'filter-chip--selected': draft.includes(option.value) }"
            :aria-label="`筛选状态${option.label}`"
            @tap="toggleLifecycle(option.value)"
          >{{ option.label }}</button>
        </view>
      </view>

      <view class="filter-actions">
        <button class="reset-button" @tap="reset">恢复默认</button>
        <button class="apply-button" @tap="apply">查看筛选结果</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.filter-layer { position: fixed; z-index: 40; inset: 0; display: flex; align-items: flex-end; }
.filter-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15,10,8,.5); }
.filter-scrim::after, .close-button::after, .filter-chip::after, .reset-button::after, .apply-button::after { border: 0; }
.filter-sheet { position: relative; z-index: 1; box-sizing: border-box; width: 100%; overflow: hidden; border-radius: 30rpx 30rpx 0 0; background: var(--color-background); box-shadow: 0 -18rpx 60rpx rgba(0,0,0,.2); }
.filter-header { display: flex; min-height: 122rpx; padding: 28rpx 30rpx 22rpx 36rpx; align-items: center; justify-content: space-between; gap: 20rpx; border-bottom: var(--app-border-width) solid var(--color-border); }
.filter-header__title { display: block; color: var(--color-text); font-size: 34rpx; font-weight: 720; }
.filter-header__subtitle { display: block; margin-top: 7rpx; color: var(--color-muted); font-size: 21rpx; }
.close-button { flex: none; width: 66rpx; height: 66rpx; margin: 0; padding: 18rpx; border: 0; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); }
.filter-section { padding: 32rpx 36rpx 38rpx; }
.filter-section__title { display: block; margin-bottom: 18rpx; color: var(--color-muted); font-size: 23rpx; font-weight: 620; }
.chip-list { display: flex; flex-wrap: wrap; gap: 13rpx; }
.filter-chip { min-height: 62rpx; margin: 0; padding: 0 22rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 31rpx; background: var(--color-surface); color: var(--color-muted); font-size: 24rpx; line-height: 60rpx; }
.filter-chip--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); font-weight: 620; }
.filter-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 16rpx; padding: 18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: var(--app-border-width) solid var(--color-border); }
.reset-button, .apply-button { height: 82rpx; margin: 0; border-radius: 18rpx; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.reset-button { border: var(--app-border-width) solid var(--color-border); background: var(--color-surface); color: var(--color-muted); }
.apply-button { border: 0; background: var(--color-accent); color: var(--color-on-accent); }
</style>
