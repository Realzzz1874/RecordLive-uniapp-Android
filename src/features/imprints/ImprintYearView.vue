<script setup lang="ts">
import { computed } from 'vue'

import type { Performance } from '@/domain/performance'
import {
  formatAggregatedAmount,
  summarizeImprintPerformances,
  summarizeImprintYear,
  type ImprintPeriodSummary,
} from '@/features/imprints/model'

interface YearCardData {
  id: string
  title: string
  summary: ImprintPeriodSummary
}

const props = defineProps<{
  performances: Performance[]
  showExpenseAmounts: boolean
}>()

const cards = computed<YearCardData[]>(() => {
  const years = [...new Set(props.performances.map(
    ({ startedAtMs }) => new Date(startedAtMs).getFullYear(),
  ))].sort((left, right) => right - left)
  const yearCards = years.map((year) => ({
    id: String(year),
    title: String(year),
    summary: summarizeImprintYear(year, props.performances),
  }))

  if (years.length <= 1) return yearCards
  return [{
    id: 'total',
    title: 'Total',
    summary: summarizeImprintPerformances(props.performances),
  }, ...yearCards]
})

function displayAmount(value: string): string {
  return props.showExpenseAmounts ? formatAggregatedAmount(value) : '***'
}

function hasAmount(value: string): boolean {
  return !/^[+-]?0(?:\.0*)?$/.test(value.trim())
}
</script>

<template>
  <scroll-view class="year-scroll" scroll-y>
    <view v-if="cards.length" class="year-content" aria-label="年度统计列表">
      <section
        v-for="card in cards"
        :key="card.id"
        class="year-card"
        :aria-label="`${card.title}年度统计，${card.summary.total}场演出`"
      >
        <text class="year-card__title">{{ card.title }}</text>

        <view class="year-card__body">
          <view class="year-card__chips">
            <text class="stat-chip stat-chip--accent">{{ card.summary.total }} 场演出</text>
            <text v-if="card.summary.artistCount" class="stat-chip stat-chip--accent">{{ card.summary.artistCount }} 组阵容</text>
            <text v-if="card.summary.playCount" class="stat-chip stat-chip--accent">{{ card.summary.playCount }} 部剧目/主题</text>
            <text v-if="card.summary.cityCount" class="stat-chip stat-chip--accent">{{ card.summary.cityCount }} 个城市</text>
          </view>

          <view
            v-for="expense in card.summary.expenses"
            :key="expense.currency"
            class="year-card__expense"
          >
            <text class="stat-chip stat-chip--neutral">货币 {{ expense.currency }}</text>
            <text class="stat-chip stat-chip--neutral">总花费 {{ displayAmount(expense.totalCost) }}</text>
            <text v-if="hasAmount(expense.ticketPrice)" class="stat-chip stat-chip--neutral">票价 {{ displayAmount(expense.ticketPrice) }}</text>
            <text v-if="hasAmount(expense.paidPrice)" class="stat-chip stat-chip--neutral">实付 {{ displayAmount(expense.paidPrice) }}</text>
            <text v-if="hasAmount(expense.otherCost)" class="stat-chip stat-chip--neutral">其它 {{ displayAmount(expense.otherCost) }}</text>
          </view>
        </view>
      </section>
    </view>

    <view v-else class="year-empty">
      <text class="year-empty__title">暂无年度统计</text>
      <text class="year-empty__description">当前筛选条件下没有演出记录</text>
    </view>
  </scroll-view>
</template>

<style scoped>
.year-scroll { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 132rpx - env(safe-area-inset-bottom)); }
.year-content { display: flex; padding: 26rpx 24rpx 64rpx; flex-direction: column; gap: 28rpx; }
.year-card { box-sizing: border-box; width: 100%; }
.year-card__title { display: block; padding-right: 10rpx; color: var(--color-accent); font-size: 42rpx; font-weight: 620; font-variant-numeric: tabular-nums; line-height: 1.25; text-align: right; }
.year-card__body { padding: 20rpx 22rpx; border: var(--app-border-width) solid var(--color-accent-border); border-radius: 18rpx; background: var(--color-background); }
.year-card__chips, .year-card__expense { display: flex; flex-wrap: wrap; gap: 9rpx; }
.year-card__chips { margin-top: 2rpx; }
.year-card__expense { margin-top: 10rpx; }
.stat-chip { display: inline-flex; min-height: 48rpx; padding: 0 15rpx; align-items: center; border-radius: 12rpx; font-size: 22rpx; font-weight: 560; line-height: 48rpx; white-space: nowrap; }
.stat-chip--accent { background: var(--color-accent-soft); color: var(--color-accent); }
.stat-chip--neutral { background: var(--color-secondary-surface); color: var(--color-muted); font-variant-numeric: tabular-nums; }
.year-empty { display: flex; height: 100%; padding: 40rpx; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.year-empty__title { color: var(--color-text); font-size: 31rpx; font-weight: 650; }
.year-empty__description { margin-top: 12rpx; color: var(--color-muted); font-size: 23rpx; }
</style>
