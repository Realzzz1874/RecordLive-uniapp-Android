<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  formatPerformanceCardDate,
  formatPerformanceLocation,
  performanceMediaPath,
  relativePerformanceDateText,
} from '@/features/performances/browser'
import type { PerformanceDisplayMode } from '@/features/preferences/model'

defineProps<{
  performance: Performance
  mode: PerformanceDisplayMode
}>()

defineEmits<{
  open: [id: string]
}>()

function isFuturePerformance(timestamp: number): boolean {
  return timestamp > Date.now()
}

function formatTimelineDate(timestamp: number): string {
  const date = new Date(timestamp)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${weekday}`
}

function formatTimelineTitle(performance: Performance): string {
  return [performance.city.trim(), performance.name.trim()].filter(Boolean).join(' · ')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <button
    v-if="mode === 'card'"
    class="performance-card"
    :aria-label="`查看${performance.name}`"
    hover-class="performance-card--pressed"
    @tap="$emit('open', performance.id)"
  >
    <image
      v-if="performanceMediaPath(performance, 'poster')"
      class="performance-card__poster"
      :src="performanceMediaPath(performance, 'poster')"
      mode="aspectFill"
    />
    <view v-else class="performance-card__poster performance-card__poster--empty">
      <AppIcon name="ticket" />
    </view>
    <view class="performance-card__content">
      <text class="performance-card__title">{{ performance.name }}</text>
      <view class="performance-card__meta-row">
        <view class="performance-card__meta-icon"><AppIcon name="calendar" /></view>
        <text class="performance-card__meta">{{ formatPerformanceCardDate(performance.startedAtMs) }}</text>
      </view>
      <view class="performance-card__meta-row">
        <view class="performance-card__meta-icon"><AppIcon name="location" /></view>
        <text class="performance-card__meta">{{ formatPerformanceLocation(performance) }}</text>
      </view>
      <view class="performance-card__footer">
        <text class="performance-card__countdown">{{ relativePerformanceDateText(performance.startedAtMs) }}</text>
      </view>
    </view>
  </button>

  <button
    v-else-if="mode === 'simple'"
    class="simple-card"
    :class="{ 'simple-card--past': !isFuturePerformance(performance.startedAtMs) }"
    :aria-label="`查看${performance.name}`"
    hover-class="simple-card--pressed"
    @tap="$emit('open', performance.id)"
  >
    <view class="simple-card__header">
      <text class="simple-card__title">{{ performance.name }}</text>
      <text class="simple-card__countdown">{{ relativePerformanceDateText(performance.startedAtMs) }}</text>
    </view>
    <view class="simple-card__body">
      <view class="simple-card__meta-row">
        <view class="simple-card__meta-icon"><AppIcon name="calendar" /></view>
        <text class="simple-card__meta">{{ formatPerformanceCardDate(performance.startedAtMs) }}</text>
      </view>
      <view class="simple-card__meta-row">
        <view class="simple-card__meta-icon"><AppIcon name="location" /></view>
        <text class="simple-card__meta">{{ formatPerformanceLocation(performance) }}</text>
      </view>
    </view>
  </button>

  <button
    v-else-if="mode === 'timeline'"
    class="timeline-item"
    :class="{ 'timeline-item--past': !isFuturePerformance(performance.startedAtMs) }"
    :aria-label="`查看${performance.name}`"
    hover-class="timeline-item--pressed"
    @tap="$emit('open', performance.id)"
  >
    <view class="timeline-item__heading">
      <view class="timeline-item__marker" />
      <text class="timeline-item__date">{{ formatTimelineDate(performance.startedAtMs) }}</text>
      <text class="timeline-item__countdown">{{ relativePerformanceDateText(performance.startedAtMs) }}</text>
    </view>
    <text class="timeline-item__title">{{ formatTimelineTitle(performance) }}</text>
  </button>

  <button
    v-else-if="mode === 'poster'"
    class="poster-card"
    :aria-label="`查看${performance.name}`"
    hover-class="poster-card--pressed"
    @tap="$emit('open', performance.id)"
  >
    <image
      v-if="performanceMediaPath(performance, 'poster')"
      class="poster-card__image"
      :src="performanceMediaPath(performance, 'poster')"
      mode="aspectFill"
    />
    <view v-else class="poster-card__image poster-card__image--empty">
      <AppIcon name="ticket" />
    </view>
  </button>
</template>

<style scoped>
.performance-card, .simple-card, .timeline-item, .poster-card { box-sizing: border-box; margin: 0; border: 0; color: var(--color-text); text-align: left; }
.performance-card::after, .simple-card::after, .timeline-item::after, .poster-card::after { border: 0; }
.performance-card { display: flex; width: 100%; min-height: 252rpx; padding: 16rpx; align-items: stretch; gap: 16rpx; border: var(--app-border-width) solid var(--color-accent-border); border-radius: 10rpx; background: var(--color-surface); }
.performance-card--pressed, .simple-card--pressed, .timeline-item--pressed, .poster-card--pressed { transform: scale(0.985); opacity: .82; }
.performance-card__poster { width: 26%; height: auto; aspect-ratio: 3 / 4; flex: none; align-self: flex-start; border-radius: 8rpx; background: var(--color-accent-soft); object-position: center; }
.performance-card__poster--empty { display: flex; align-items: center; justify-content: center; color: var(--color-accent); }
.performance-card__poster--empty > :first-child { width: 48rpx; height: 48rpx; }
.performance-card__content { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: flex-start; gap: 11rpx; }
.performance-card__title { display: -webkit-box; width: 100%; overflow: hidden; color: var(--color-text); font-size: 29rpx; font-weight: 650; line-height: 1.35; text-overflow: ellipsis; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.performance-card__meta-row { display: flex; width: 100%; min-width: 0; align-items: center; gap: 9rpx; }
.performance-card__meta-icon { width: 27rpx; height: 27rpx; flex: none; color: var(--color-accent); }
.performance-card__meta { min-width: 0; overflow: hidden; color: var(--color-text); font-size: 22rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.performance-card__footer { display: flex; margin-top: auto; align-items: center; }
.performance-card__countdown { padding: 7rpx 18rpx; border-radius: 14rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 20rpx; font-weight: 620; line-height: 1.25; }
.simple-card { width: 100%; overflow: hidden; padding: 0; border: var(--app-border-width) solid var(--color-accent); border-radius: 12rpx; background: var(--color-surface); }
.simple-card__header { display: flex; min-height: 72rpx; padding: 14rpx 18rpx; align-items: center; gap: 16rpx; background: var(--color-accent); color: var(--color-on-accent); }
.simple-card__title { display: -webkit-box; min-width: 0; overflow: hidden; flex: 1; font-size: 27rpx; font-weight: 650; line-height: 1.35; text-overflow: ellipsis; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.simple-card__countdown { flex: none; font-size: 22rpx; font-weight: 620; white-space: nowrap; }
.simple-card__body { display: flex; padding: 17rpx 18rpx; flex-direction: column; gap: 14rpx; }
.simple-card__meta-row { display: flex; min-width: 0; align-items: center; gap: 11rpx; }
.simple-card__meta-icon { width: 28rpx; height: 28rpx; flex: none; color: var(--color-accent); }
.simple-card__meta { min-width: 0; overflow: hidden; color: var(--color-text); font-size: 23rpx; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.simple-card--past { border-color: var(--color-muted); }
.simple-card--past .simple-card__header { background: var(--color-muted); }
.simple-card--past .simple-card__meta-icon { color: var(--color-muted); }
.timeline-item { position: relative; display: block; width: 100%; min-height: 108rpx; padding: 8rpx 8rpx 12rpx 0; background: transparent; }
.timeline-item__heading { display: flex; min-width: 0; align-items: center; gap: 11rpx; }
.timeline-item__marker { width: 22rpx; height: 22rpx; flex: none; border-radius: 50%; background: var(--color-accent); }
.timeline-item__date { min-width: 0; overflow: hidden; flex: none; color: var(--color-accent); font-size: 24rpx; font-weight: 650; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.timeline-item__countdown { min-width: 0; overflow: hidden; padding: 4rpx 9rpx; border-radius: 8rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 20rpx; font-weight: 620; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.timeline-item__title { display: -webkit-box; margin-top: 11rpx; padding-left: 33rpx; overflow: hidden; color: var(--color-text); font-size: 26rpx; line-height: 1.45; text-overflow: ellipsis; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.timeline-item--past .timeline-item__marker { background: var(--color-border); }
.timeline-item--past .timeline-item__date { color: var(--color-muted); }
.timeline-item--past .timeline-item__countdown { color: var(--color-muted); }
.poster-card { position: relative; width: 100%; height: auto; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 8rpx; background: var(--color-accent-soft); }
.poster-card__image { position: absolute; inset: 0; width: 100%; height: 100%; object-position: center; }
.poster-card__image--empty { display: flex; align-items: center; justify-content: center; color: var(--color-accent); }
.poster-card__image--empty > :first-child { width: 42%; height: 42%; max-width: 76rpx; max-height: 76rpx; opacity: .7; }
</style>
