<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { PerformanceDisplayMode } from '@/features/preferences/model'

withDefaults(defineProps<{
  activeFilterCount?: number
  displayMode: PerformanceDisplayMode
  showFilter?: boolean
}>(), {
  activeFilterCount: 0,
  showFilter: true,
})

defineEmits<{
  filter: []
  displayMode: [mode: PerformanceDisplayMode]
}>()
</script>

<template>
  <view class="browse-toolbar">
    <button
      v-if="showFilter"
      class="filter-button"
      :class="{ 'filter-button--active': activeFilterCount > 0 }"
      aria-label="筛选演出"
      hover-class="toolbar-button--pressed"
      @tap="$emit('filter')"
    >
      <AppIcon name="filter" />
      <text>筛选</text>
      <text v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</text>
    </button>
    <text v-else class="toolbar-hint">按演出时间排列</text>

    <view class="display-switch" aria-label="展示方式">
      <button
        class="display-button"
        :class="{ 'display-button--active': displayMode === 'card' }"
        aria-label="卡片展示"
        @tap="$emit('displayMode', 'card')"
      ><AppIcon name="list" /></button>
      <button
        class="display-button"
        :class="{ 'display-button--active': displayMode === 'poster' }"
        aria-label="海报展示"
        @tap="$emit('displayMode', 'poster')"
      ><AppIcon name="grid" /></button>
    </view>
  </view>
</template>

<style scoped>
.browse-toolbar { box-sizing: border-box; display: flex; min-height: 92rpx; padding: 14rpx 30rpx; align-items: center; justify-content: space-between; border-bottom: 1rpx solid var(--color-border); background: var(--color-background); }
.filter-button { display: flex; height: 62rpx; margin: 0; padding: 0 18rpx; align-items: center; gap: 10rpx; border: 1rpx solid var(--color-border); border-radius: 31rpx; background: var(--color-surface); color: var(--color-muted); font-size: 24rpx; line-height: 62rpx; }
.filter-button::after, .display-button::after { border: 0; }
.filter-button > :first-child { width: 30rpx; height: 30rpx; }
.filter-button--active { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); }
.filter-count { display: flex; min-width: 32rpx; height: 32rpx; padding: 0 7rpx; align-items: center; justify-content: center; border-radius: 16rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 19rpx; line-height: 32rpx; }
.toolbar-hint { color: var(--color-muted); font-size: 23rpx; }
.display-switch { display: flex; padding: 5rpx; border: 1rpx solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.display-button { width: 58rpx; height: 50rpx; margin: 0; padding: 13rpx 17rpx; border: 0; border-radius: 13rpx; background: transparent; color: var(--color-muted); }
.display-button--active { background: var(--color-accent-soft); color: var(--color-accent); }
.toolbar-button--pressed { opacity: .7; }
</style>
