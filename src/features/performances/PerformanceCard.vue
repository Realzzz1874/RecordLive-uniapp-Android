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
    v-else
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
.performance-card, .poster-card { box-sizing: border-box; margin: 0; border: 0; color: var(--color-text); text-align: left; }
.performance-card::after, .poster-card::after { border: 0; }
.performance-card { display: flex; width: 100%; min-height: 252rpx; padding: 16rpx; align-items: stretch; gap: 16rpx; border: 1rpx solid var(--color-accent-border); border-radius: 10rpx; background: var(--color-surface); }
.performance-card--pressed, .poster-card--pressed { transform: scale(0.985); opacity: .82; }
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
.poster-card { position: relative; width: 100%; height: auto; aspect-ratio: 3 / 4; overflow: hidden; border-radius: 8rpx; background: var(--color-accent-soft); }
.poster-card__image { position: absolute; inset: 0; width: 100%; height: 100%; object-position: center; }
.poster-card__image--empty { display: flex; align-items: center; justify-content: center; color: var(--color-accent); }
.poster-card__image--empty > :first-child { width: 42%; height: 42%; max-width: 76rpx; max-height: 76rpx; opacity: .7; }
</style>
