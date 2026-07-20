<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  formatPerformanceDate,
  formatPerformanceLocation,
  performanceLifecycleLabel,
  performanceMediaPath,
} from '@/features/performances/browser'
import type { PerformanceDisplayMode } from '@/features/preferences/model'

defineProps<{
  performance: Performance
  mode: PerformanceDisplayMode
}>()

defineEmits<{
  open: [id: string]
}>()

function shortMonth(timestamp: number): string {
  return `${new Date(timestamp).getMonth() + 1}月`
}

function day(timestamp: number): string {
  return String(new Date(timestamp).getDate()).padStart(2, '0')
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
    <view class="performance-card__date">
      <text class="performance-card__day">{{ day(performance.startedAtMs) }}</text>
      <text class="performance-card__month">{{ shortMonth(performance.startedAtMs) }}</text>
    </view>
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
      <view class="performance-card__title-row">
        <text class="performance-card__title">{{ performance.name }}</text>
        <text class="status-pill">{{ performanceLifecycleLabel(performance) }}</text>
      </view>
      <text class="performance-card__meta">{{ formatPerformanceDate(performance.startedAtMs, true) }}</text>
      <text class="performance-card__meta">{{ formatPerformanceLocation(performance) }}</text>
      <text v-if="performance.facets.artist?.length" class="performance-card__artist">
        {{ performance.facets.artist.join('、') }}
      </text>
    </view>
    <view class="performance-card__chevron"><AppIcon name="chevron" /></view>
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
      <text>{{ shortMonth(performance.startedAtMs) }} {{ day(performance.startedAtMs) }}</text>
    </view>
    <view class="poster-card__shade" />
    <text class="poster-card__status">{{ performanceLifecycleLabel(performance) }}</text>
    <view class="poster-card__copy">
      <text class="poster-card__title">{{ performance.name }}</text>
      <text class="poster-card__meta">{{ formatPerformanceLocation(performance) }}</text>
    </view>
  </button>
</template>

<style scoped>
.performance-card, .poster-card { box-sizing: border-box; margin: 0; border: 0; color: var(--color-text); text-align: left; }
.performance-card::after, .poster-card::after { border: 0; }
.performance-card { display: flex; width: 100%; min-height: 176rpx; padding: 18rpx; align-items: center; gap: 18rpx; border: 1rpx solid var(--color-border); border-radius: 22rpx; background: var(--color-surface); box-shadow: 0 8rpx 24rpx var(--color-tab-shadow); }
.performance-card--pressed, .poster-card--pressed { transform: scale(0.985); opacity: .82; }
.performance-card__date { display: flex; width: 68rpx; flex: none; flex-direction: column; align-items: center; }
.performance-card__day { color: var(--color-accent); font-size: 38rpx; font-weight: 750; line-height: 1; }
.performance-card__month { margin-top: 8rpx; color: var(--color-muted); font-size: 21rpx; }
.performance-card__poster { width: 104rpx; height: 136rpx; flex: none; border-radius: 14rpx; background: var(--color-accent-soft); }
.performance-card__poster--empty { display: flex; align-items: center; justify-content: center; color: var(--color-accent); }
.performance-card__poster--empty > :first-child { width: 48rpx; height: 48rpx; }
.performance-card__content { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.performance-card__title-row { display: flex; min-width: 0; align-items: center; gap: 12rpx; }
.performance-card__title { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text); font-size: 30rpx; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.status-pill { flex: none; padding: 5rpx 12rpx; border-radius: 18rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 20rpx; }
.performance-card__meta, .performance-card__artist { margin-top: 7rpx; overflow: hidden; color: var(--color-muted); font-size: 23rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.performance-card__artist { color: var(--color-accent); }
.performance-card__chevron { width: 28rpx; height: 28rpx; flex: none; color: var(--color-muted); }
.poster-card { position: relative; width: 100%; height: 420rpx; overflow: hidden; border-radius: 22rpx; background: var(--color-accent-soft); box-shadow: 0 8rpx 24rpx var(--color-tab-shadow); }
.poster-card__image { width: 100%; height: 100%; }
.poster-card__image--empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20rpx; color: var(--color-accent); }
.poster-card__image--empty > :first-child { width: 76rpx; height: 76rpx; opacity: .84; }
.poster-card__image--empty > text { font-size: 25rpx; font-weight: 650; }
.poster-card__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,14,11,.02) 35%, rgba(20,14,11,.85)); }
.poster-card__status { position: absolute; top: 18rpx; right: 18rpx; padding: 6rpx 13rpx; border-radius: 18rpx; background: rgba(28,20,16,.74); color: #fff; font-size: 20rpx; }
.poster-card__copy { position: absolute; right: 20rpx; bottom: 20rpx; left: 20rpx; display: flex; flex-direction: column; }
.poster-card__title { overflow: hidden; color: #fff; font-size: 29rpx; font-weight: 720; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.poster-card__meta { margin-top: 7rpx; overflow: hidden; color: rgba(255,255,255,.74); font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
</style>
