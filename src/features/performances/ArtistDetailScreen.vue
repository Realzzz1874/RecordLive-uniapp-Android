<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import { formatAggregatedAmount, listAllPerformances } from '@/features/imprints/model'
import {
  buildArtistDetailSummary,
  type ArtistDetailRankEntry,
  type ArtistDetailSummary,
} from '@/features/performances/artist-detail'
import { artistIntensityLevel } from '@/features/performances/artist-summary'
import PerformanceCard from '@/features/performances/PerformanceCard.vue'
import { getAppRepositories } from '@/platform/repositories/context'

const props = defineProps<{
  artistName: string
  refreshKey: number
}>()

const emit = defineEmits<{
  back: []
  open: [id: string]
}>()

const loading = ref(true)
const summary = ref<ArtistDetailSummary>({
  performances: [],
  expenses: [],
  plays: [],
  cities: [],
})
let requestSequence = 0

const performanceCount = computed(() => String(summary.value.performances.length))

onMounted(load)
watch(() => props.refreshKey, load)
watch(() => props.artistName, load)

async function load(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    const performances = await listAllPerformances(repositories.performances)
    if (sequence !== requestSequence) return
    summary.value = buildArtistDetailSummary(props.artistName, performances)
  } catch (error) {
    if (sequence !== requestSequence) return
    uni.showToast({
      title: error instanceof Error ? error.message : '加载阵容统计失败',
      icon: 'none',
    })
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function rankClass(item: ArtistDetailRankEntry): string {
  return `rank-chip--level-${artistIntensityLevel(item.times)}`
}
</script>

<template>
  <view class="artist-detail-screen">
    <AppHeader
      :title="artistName"
      :count="performanceCount"
      show-back
      back-label="返回阵容统计"
      @back="$emit('back')"
    />

    <view v-if="loading" class="loading-state">正在汇总阵容数据…</view>
    <scroll-view v-else class="artist-detail-content" scroll-y>
      <view class="artist-identity">
        <text class="artist-identity__name">@ {{ artistName }}</text>
        <text class="artist-identity__count">✘ {{ summary.performances.length }} 场</text>
      </view>

      <view v-if="summary.expenses.length" class="summary-card" aria-label="花费统计">
        <view class="summary-card__heading">
          <view class="summary-card__icon"><AppIcon name="ticket" /></view>
          <text class="summary-card__title">花费</text>
        </view>
        <view
          v-for="expense in summary.expenses"
          :key="expense.currency"
          class="expense-group"
        >
          <text class="expense-group__currency">{{ expense.currency }}</text>
          <view class="expense-grid">
            <view class="expense-item">
              <text class="expense-item__label">票面价</text>
              <text class="expense-item__value">{{ formatAggregatedAmount(expense.ticketPrice) }}</text>
            </view>
            <view class="expense-item">
              <text class="expense-item__label">实付价</text>
              <text class="expense-item__value">{{ formatAggregatedAmount(expense.paidPrice) }}</text>
            </view>
            <view class="expense-item">
              <text class="expense-item__label">其他花费</text>
              <text class="expense-item__value">{{ formatAggregatedAmount(expense.otherCost) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="summary.plays.length" class="summary-card" aria-label="剧目主题统计">
        <view class="summary-card__heading">
          <view class="summary-card__icon"><AppIcon name="award" /></view>
          <text class="summary-card__title">剧目/主题</text>
          <text class="summary-card__count">✘{{ summary.plays.length }}</text>
        </view>
        <view class="rank-list">
          <text
            v-for="item in summary.plays"
            :key="item.name"
            class="rank-chip"
            :class="rankClass(item)"
          >{{ item.name }} ✘{{ item.times }}</text>
        </view>
      </view>

      <view v-if="summary.cities.length" class="summary-card" aria-label="城市统计">
        <view class="summary-card__heading">
          <view class="summary-card__icon"><AppIcon name="location" /></view>
          <text class="summary-card__title">城市</text>
          <text class="summary-card__count">✘{{ summary.cities.length }}</text>
        </view>
        <view class="rank-list">
          <text
            v-for="item in summary.cities"
            :key="item.name"
            class="rank-chip"
            :class="rankClass(item)"
          >{{ item.name }} ✘{{ item.times }}</text>
        </view>
      </view>

      <view class="performance-section">
        <view class="performance-section__heading">
          <text class="performance-section__title">演出列表</text>
          <text class="performance-section__count">共 {{ summary.performances.length }} 场</text>
        </view>
        <view v-if="summary.performances.length" class="performance-list">
          <PerformanceCard
            v-for="performance in summary.performances"
            :key="performance.id"
            :performance="performance"
            mode="card"
            @open="$emit('open', $event)"
          />
        </view>
        <text v-else class="empty-state">没有找到包含该阵容的演出</text>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.artist-detail-screen { min-height: 100vh; background: var(--color-background); }
.loading-state { display: flex; min-height: calc(100vh - var(--app-header-height)); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.artist-detail-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 24rpx 26rpx calc(48rpx + env(safe-area-inset-bottom)); }
.artist-identity { display: flex; padding: 6rpx 4rpx 20rpx; flex-direction: column; gap: 8rpx; }
.artist-identity__name { overflow: hidden; color: var(--color-accent); font-size: 34rpx; font-weight: 680; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.artist-identity__count { color: var(--color-muted); font-size: 23rpx; }
.summary-card { margin-bottom: 18rpx; padding: 18rpx; border: var(--app-border-width) solid var(--color-border-subtle); border-radius: 16rpx; background: var(--color-surface); }
.summary-card__heading { display: flex; min-height: 42rpx; align-items: center; gap: 11rpx; color: var(--color-accent); }
.summary-card__icon { width: 31rpx; height: 31rpx; flex: none; }
.summary-card__title { font-size: 27rpx; font-weight: 650; }
.summary-card__count { margin-left: auto; color: var(--color-muted); font-size: 22rpx; }
.expense-group { margin-top: 16rpx; padding-top: 15rpx; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.expense-group__currency { display: block; margin-bottom: 12rpx; color: var(--color-muted); font-size: 21rpx; font-weight: 620; }
.expense-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.expense-item { display: flex; min-width: 0; padding: 2rpx 8rpx; align-items: center; flex-direction: column; gap: 8rpx; }
.expense-item + .expense-item { border-left: var(--app-border-width) solid var(--color-border-subtle); }
.expense-item__label { color: var(--color-muted); font-size: 21rpx; white-space: nowrap; }
.expense-item__value { max-width: 100%; overflow: hidden; color: var(--color-accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 25rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.rank-list { display: flex; margin-top: 15rpx; flex-wrap: wrap; gap: 9rpx; }
.rank-chip { position: relative; overflow: hidden; padding: 8rpx 13rpx; border-radius: 14rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 23rpx; font-weight: 620; line-height: 1.3; }
.rank-chip--level-0 { background: var(--color-accent-soft); color: var(--color-accent); }
.rank-chip--level-1 { opacity: .72; }
.rank-chip--level-2 { opacity: .82; }
.rank-chip--level-3 { opacity: .91; }
.performance-section { padding-top: 12rpx; }
.performance-section__heading { display: flex; padding: 8rpx 4rpx 18rpx; align-items: center; }
.performance-section__title { color: var(--color-text); font-size: 28rpx; font-weight: 680; }
.performance-section__count { margin-left: auto; color: var(--color-muted); font-size: 22rpx; }
.performance-list { display: flex; flex-direction: column; gap: 18rpx; }
.empty-state { display: block; padding: 80rpx 0; color: var(--color-muted); font-size: 25rpx; text-align: center; }
</style>
