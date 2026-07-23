<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance, PerformanceLifecycle } from '@/domain/performance'
import { formatAggregatedAmount, listAllPerformances } from '@/features/imprints/model'
import {
  buildPlayDetailSummary,
  type ArtistDetailRankEntry,
  type PlayDetailSummary,
} from '@/features/performances/artist-detail'
import { artistIntensityLevel } from '@/features/performances/artist-summary'
import PerformanceCard from '@/features/performances/PerformanceCard.vue'
import PerformanceLifecycleFilterSheet from '@/features/performances/PerformanceLifecycleFilterSheet.vue'
import { ALL_PERFORMANCE_LIFECYCLES } from '@/features/preferences/model'
import { getAppRepositories } from '@/platform/repositories/context'
import { useBrowsePreferencesStore } from '@/stores/browse-preferences'
import { useImprintPreferencesStore } from '@/stores/imprint-preferences'

const props = defineProps<{
  playName: string
  refreshKey: number
  performanceIds?: string[] | null
}>()

defineEmits<{
  back: []
  open: [id: string]
}>()

const imprintPreferencesStore = useImprintPreferencesStore()
const browsePreferencesStore = useBrowsePreferencesStore()
const { showExpenseAmounts } = storeToRefs(imprintPreferencesStore)
const { filter } = storeToRefs(browsePreferencesStore)
const loading = ref(true)
const performances = ref<Performance[]>([])
const filterVisible = ref(false)
let requestSequence = 0

const hasPerformanceScope = computed(() => props.performanceIds !== undefined && props.performanceIds !== null)
const scopedPerformances = computed(() => {
  if (!hasPerformanceScope.value) return performances.value
  const ids = new Set(props.performanceIds ?? [])
  return performances.value.filter(({ id }) => ids.has(id))
})
const summary = computed<PlayDetailSummary>(() => buildPlayDetailSummary(
  props.playName,
  scopedPerformances.value,
  hasPerformanceScope.value ? undefined : filter.value.lifecycles,
))
const performanceCount = computed(() => String(summary.value.performances.length))
const activeFilterCount = computed(() => (
  hasPerformanceScope.value || filter.value.lifecycles.length === ALL_PERFORMANCE_LIFECYCLES.length ? 0 : 1
))

onMounted(async () => {
  await Promise.all([
    imprintPreferencesStore.initialize(),
    browsePreferencesStore.initialize(),
  ])
  await load()
})
watch(() => props.refreshKey, load)
watch(() => props.playName, load)
watch(() => props.performanceIds, load, { deep: true })

async function load(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    const items = await listAllPerformances(repositories.performances)
    if (sequence !== requestSequence) return
    performances.value = items
  } catch (error) {
    if (sequence !== requestSequence) return
    uni.showToast({
      title: error instanceof Error ? error.message : '加载剧目/主题统计失败',
      icon: 'none',
    })
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function rankClass(item: ArtistDetailRankEntry): string {
  return `app-intensity-chip--level-${artistIntensityLevel(item.times)}`
}

function applyLifecycleFilter(lifecycles: PerformanceLifecycle[]): void {
  browsePreferencesStore.setFilter({
    ...filter.value,
    lifecycles,
  })
}
</script>

<template>
  <view class="play-detail-screen">
    <AppHeader
      :title="playName"
      :count="performanceCount"
      show-back
      :show-filter="!hasPerformanceScope"
      back-label="返回剧目/主题统计"
      filter-label="筛选剧目主题演出状态"
      :filter-count="activeFilterCount"
      @back="$emit('back')"
      @filter="filterVisible = true"
    />

    <view v-if="loading" class="loading-state">正在汇总剧目/主题数据…</view>
    <scroll-view v-else class="play-detail-content" scroll-y>
      <view class="play-identity">
        <view class="play-identity__heading">
          <!-- <view class="play-identity__icon"><AppIcon name="theatermasks.circle" /></view> -->
          <text class="play-identity__name">{{ playName }}</text>
        </view>
        <text class="play-identity__count">✘ {{ summary.performances.length }} 场</text>
      </view>

      <view v-if="summary.expenses.length" class="summary-card app-stat-card" aria-label="花费统计">
        <view class="expense-heading">
          <view class="expense-heading__title">
            <view class="expense-heading__icon"><AppIcon name="dollarsign.circle" /></view>
            <text>花费{{ summary.expenses.length === 1 ? `(${summary.expenses[0]?.currency})` : '' }}</text>
          </view>
          <button
            class="expense-heading__action"
            :aria-label="showExpenseAmounts ? '隐藏花费金额' : '显示花费金额'"
            @tap="imprintPreferencesStore.setShowExpenseAmounts(!showExpenseAmounts)"
          >
            <AppIcon :name="showExpenseAmounts ? 'eye' : 'eye.slash'" />
          </button>
        </view>
        <view v-for="expense in summary.expenses" :key="expense.currency" class="expense-group">
          <text v-if="summary.expenses.length > 1" class="expense-currency">{{ expense.currency }}</text>
          <view class="expense-columns">
            <view class="expense-metric">
              <text class="expense-metric__label">票价</text>
              <text class="expense-metric__value">{{ showExpenseAmounts ? formatAggregatedAmount(expense.ticketPrice) : '***' }}</text>
            </view>
            <view class="expense-metric">
              <text class="expense-metric__label">实付</text>
              <text class="expense-metric__value">{{ showExpenseAmounts ? formatAggregatedAmount(expense.paidPrice) : '***' }}</text>
            </view>
            <view class="expense-metric">
              <text class="expense-metric__label">其它</text>
              <text class="expense-metric__value">{{ showExpenseAmounts ? formatAggregatedAmount(expense.otherCost) : '***' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="summary.artists.length" class="summary-card app-stat-card" aria-label="阵容统计">
        <view class="summary-card__heading">
          <view class="summary-card__icon"><AppIcon name="square.on.square.badge.person.crop" /></view>
          <text class="summary-card__title">阵容</text>
          <text class="summary-card__count">✘{{ summary.artists.length }}</text>
        </view>
        <view class="rank-list">
          <view
            v-for="item in summary.artists"
            :key="item.name"
            class="rank-chip app-intensity-chip"
            :class="rankClass(item)"
          >
            <text>{{ item.name }} ✘{{ item.times }}</text>
          </view>
        </view>
      </view>

      <view v-if="summary.cities.length" class="summary-card app-stat-card" aria-label="城市统计">
        <view class="summary-card__heading">
          <view class="summary-card__icon"><AppIcon name="location" /></view>
          <text class="summary-card__title">城市</text>
          <text class="summary-card__count">✘{{ summary.cities.length }}</text>
        </view>
        <view class="rank-list">
          <view
            v-for="item in summary.cities"
            :key="item.name"
            class="rank-chip app-intensity-chip"
            :class="rankClass(item)"
          >
            <text>{{ item.name }} ✘{{ item.times }}</text>
          </view>
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
        <text v-else class="empty-state">没有找到包含该剧目/主题的演出</text>
      </view>
    </scroll-view>

    <PerformanceLifecycleFilterSheet
      v-if="!hasPerformanceScope"
      :visible="filterVisible"
      :lifecycles="filter.lifecycles"
      @close="filterVisible = false"
      @apply="applyLifecycleFilter"
    />
  </view>
</template>

<style scoped>
.play-detail-screen { min-height: 100vh; background: var(--color-background); }
.loading-state { display: flex; min-height: calc(100vh - var(--app-header-height)); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.play-detail-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 24rpx 26rpx calc(48rpx + env(safe-area-inset-bottom)); }
.play-identity { display: flex; padding: 6rpx 4rpx 20rpx; flex-direction: column; gap: 8rpx; }
.play-identity__heading { display: flex; min-width: 0; align-items: center; gap: 9rpx; color: var(--color-accent); }
.play-identity__icon { width: 31rpx; height: 31rpx; flex: none; }
.play-identity__name { overflow: hidden; color: var(--color-accent); font-size: 34rpx; font-weight: 680; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.play-identity__count { color: var(--color-muted); font-size: 23rpx; }
.summary-card__heading { display: flex; min-height: 42rpx; align-items: center; gap: 11rpx; color: var(--color-accent); }
.summary-card__icon { width: 31rpx; height: 31rpx; flex: none; }
.summary-card__title { font-size: 27rpx; font-weight: 650; }
.summary-card__count { margin-left: auto; color: var(--color-muted); font-size: 22rpx; }
.expense-heading { display: flex; min-height: 34rpx; margin-bottom: 20rpx; align-items: center; justify-content: space-between; gap: 8rpx; color: var(--color-accent); font-size: 25rpx; font-weight: 650; }
.expense-heading__title { display: flex; min-width: 0; align-items: center; gap: 8rpx; }
.expense-heading__icon { width: 28rpx; height: 28rpx; flex: none; }
.expense-heading__action { display: flex; width: 52rpx; height: 44rpx; margin: -6rpx -6rpx -6rpx 0; padding: 10rpx 14rpx; align-items: center; justify-content: center; border: 0; border-radius: 12rpx; background: transparent; color: var(--color-accent); }
.expense-heading__action::after { border: 0; }
.expense-group + .expense-group { margin-top: 16rpx; padding-top: 16rpx; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.expense-currency { display: block; margin-bottom: 10rpx; color: var(--color-accent); font-size: 20rpx; font-weight: 650; }
.expense-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.expense-metric { display: flex; min-width: 0; align-items: center; flex-direction: column; gap: 7rpx; text-align: center; }
.expense-metric__label { color: var(--color-muted); font-size: 20rpx; }
.expense-metric__value { max-width: 100%; overflow: hidden; color: var(--color-accent); font-size: 28rpx; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.rank-list { display: flex; margin-top: 15rpx; flex-wrap: wrap; gap: 9rpx; }
.rank-chip { position: relative; overflow: hidden; padding: 8rpx 13rpx; border-radius: 14rpx; font-size: 23rpx; font-weight: 620; line-height: 1.3; }
.performance-section { padding-top: 12rpx; }
.performance-section__heading { display: flex; padding: 8rpx 4rpx 18rpx; align-items: center; }
.performance-section__title { color: var(--color-text); font-size: 28rpx; font-weight: 680; }
.performance-section__count { margin-left: auto; color: var(--color-muted); font-size: 22rpx; }
.performance-list { display: flex; flex-direction: column; gap: 18rpx; }
.empty-state { display: block; padding: 80rpx 0; color: var(--color-muted); font-size: 25rpx; text-align: center; }
</style>
