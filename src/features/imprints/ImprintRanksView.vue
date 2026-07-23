<script setup lang="ts">
import { computed, ref } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  formatAggregatedAmount,
  formatImprintPercentage,
  imprintExpenseMetricValue,
  summarizeImprintExpenseRank,
  summarizeImprintTimesRank,
  type ImprintExpenseMetric,
} from '@/features/imprints/model'
import type { ImprintRankView } from '@/stores/imprint-preferences'

const props = defineProps<{
  performances: Performance[]
  view: ImprintRankView
  showExpenseAmounts: boolean
}>()

const emit = defineEmits<{
  selectArtist: [name: string]
  selectPlay: [name: string]
  updateView: [view: ImprintRankView]
}>()

const artistExpenseMetric = ref<ImprintExpenseMetric>('ticketPrice')
const playExpenseMetric = ref<ImprintExpenseMetric>('ticketPrice')
const expenseMetricOptions: readonly { value: ImprintExpenseMetric; label: string }[] = [
  { value: 'ticketPrice', label: '票价总计' },
  { value: 'paidPrice', label: '实付总计' },
  { value: 'otherCost', label: '其它花费总计' },
  { value: 'ticketAndOther', label: '总花费(票价+其它)' },
  { value: 'paidAndOther', label: '总花费(实付+其它)' },
]

const artistTimes = computed(() => summarizeImprintTimesRank(props.performances, 'artist'))
const playTimes = computed(() => summarizeImprintTimesRank(props.performances, 'play'))
const isPlayExpense = computed(() => props.view === 'play-expense')
const expenseMetric = computed<ImprintExpenseMetric>({
  get: () => (
    isPlayExpense.value ? playExpenseMetric.value : artistExpenseMetric.value
  ),
  set: (value) => {
    if (isPlayExpense.value) playExpenseMetric.value = value
    else artistExpenseMetric.value = value
  },
})
const currentExpenses = computed(() => summarizeImprintExpenseRank(
  props.performances,
  isPlayExpense.value ? 'play' : 'artist',
  expenseMetric.value,
))
const selectedExpenseMetricLabel = computed(() => (
  expenseMetricOptions.find(({ value }) => value === expenseMetric.value)?.label ?? ''
))
const expenseSummaryLabel = computed(() => {
  if (!currentExpenses.value.length) return props.showExpenseAmounts ? '0.00' : '***'
  if (currentExpenses.value.length > 1) return `${currentExpenses.value.length} 种货币`
  const group = currentExpenses.value[0]
  return group
    ? `${displayAmount(group.totals[expenseMetric.value])} ${group.currency}`
    : '0.00'
})

const currentTimes = computed(() => (
  props.view === 'play-times' ? playTimes.value : artistTimes.value
))

function selectTimesEntry(name: string): void {
  if (props.view === 'play-times') emit('selectPlay', name)
  else emit('selectArtist', name)
}

function selectExpenseEntry(name: string): void {
  if (isPlayExpense.value) emit('selectPlay', name)
  else emit('selectArtist', name)
}

function selectExpenseMetric(): void {
  uni.showActionSheet({
    title: '可切换不同维度查看',
    itemList: expenseMetricOptions.map(({ label }) => label),
    success: ({ tapIndex }) => {
      const selected = expenseMetricOptions[tapIndex]
      if (selected) expenseMetric.value = selected.value
    },
  })
}

function positionLabel(index: number): string {
  return ['🥇', '🥈', '🥉'][index] ?? `${index + 1}.`
}

function displayAmount(value: string): string {
  return props.showExpenseAmounts ? formatAggregatedAmount(value) : '***'
}
</script>

<template>
  <scroll-view class="ranks-scroll" scroll-y>
    <view v-if="view === 'overview'" class="ranks-overview" aria-label="榜榜榜列表">
      <section class="rank-section">
        <text class="rank-section__title">演出</text>
        <view class="overview-row overview-row--static" :aria-label="`演出场次${performances.length}场`">
          <view class="overview-row__icon"><AppIcon name="award" /></view>
          <text class="overview-row__label">场次</text>
          <text class="overview-row__value">✘{{ performances.length }}</text>
        </view>
      </section>

      <section class="rank-section">
        <text class="rank-section__title">阵容</text>
        <view class="rank-section__card">
          <button
            class="overview-row"
            aria-label="查看阵容次数排行"
            hover-class="overview-row--pressed"
            @tap="emit('updateView', 'artist-times')"
          >
            <view class="overview-row__icon"><AppIcon name="square.on.square.badge.person.crop" /></view>
            <text class="overview-row__label">次数排行</text>
            <view class="overview-row__chevron"><AppIcon name="chevron" /></view>
          </button>
          <button
            class="overview-row overview-row--separated"
            aria-label="查看阵容花费排行"
            hover-class="overview-row--pressed"
            @tap="emit('updateView', 'artist-expense')"
          >
            <view class="overview-row__icon"><AppIcon name="dollarsign.circle" /></view>
            <text class="overview-row__label">花费排行</text>
            <view class="overview-row__chevron"><AppIcon name="chevron" /></view>
          </button>
        </view>
      </section>

      <section class="rank-section">
        <text class="rank-section__title">剧目/主题</text>
        <view class="rank-section__card">
          <button
            class="overview-row"
            aria-label="查看剧目主题次数排行"
            hover-class="overview-row--pressed"
            @tap="emit('updateView', 'play-times')"
          >
            <view class="overview-row__icon"><AppIcon name="theatermasks.circle" /></view>
            <text class="overview-row__label">次数排行</text>
            <view class="overview-row__chevron"><AppIcon name="chevron" /></view>
          </button>
          <button
            class="overview-row overview-row--separated"
            aria-label="查看剧目主题花费排行"
            hover-class="overview-row--pressed"
            @tap="emit('updateView', 'play-expense')"
          >
            <view class="overview-row__icon"><AppIcon name="dollarsign.circle" /></view>
            <text class="overview-row__label">花费排行</text>
            <view class="overview-row__chevron"><AppIcon name="chevron" /></view>
          </button>
        </view>
      </section>
    </view>

    <view
      v-else-if="view === 'artist-times' || view === 'play-times'"
      class="rank-detail"
      :aria-label="view === 'artist-times' ? '阵容次数排行列表' : '剧目主题次数排行列表'"
    >
      <template v-if="currentTimes.length">
        <text class="rank-subsection-title">🏆 TOP {{ Math.min(3, currentTimes.length) }}</text>
        <view class="rank-list-card">
          <button
            v-for="(entry, index) in currentTimes.slice(0, 3)"
            :key="entry.name"
            class="rank-row"
            :class="{ 'rank-row--separated': index > 0 }"
            :aria-label="`第${index + 1}名${entry.name}，${entry.times}场，查看统计详情`"
            hover-class="rank-row--pressed"
            @tap="selectTimesEntry(entry.name)"
          >
            <text class="rank-row__position">{{ positionLabel(index) }}</text>
            <text class="rank-row__name">{{ entry.name }}</text>
            <text class="rank-row__primary">✘{{ entry.times }} 场</text>
            <view class="rank-row__chevron"><AppIcon name="chevron" /></view>
          </button>
        </view>

        <template v-if="currentTimes.length > 3">
          <text class="rank-subsection-title rank-subsection-title--more">更多 +{{ currentTimes.length - 3 }}</text>
          <view class="rank-list-card">
            <button
              v-for="(entry, offset) in currentTimes.slice(3)"
              :key="entry.name"
              class="rank-row rank-row--compact"
              :class="{ 'rank-row--separated': offset > 0 }"
              :aria-label="`第${offset + 4}名${entry.name}，${entry.times}场，查看统计详情`"
              hover-class="rank-row--pressed"
              @tap="selectTimesEntry(entry.name)"
            >
              <text class="rank-row__position">{{ offset + 4 }}.</text>
              <text class="rank-row__name">{{ entry.name }}</text>
              <text class="rank-row__primary">✘{{ entry.times }} 场</text>
              <view class="rank-row__chevron"><AppIcon name="chevron" /></view>
            </button>
          </view>
        </template>
      </template>

      <view v-else class="rank-empty">
        <view class="rank-empty__icon">
          <AppIcon :name="view === 'artist-times' ? 'square.on.square.badge.person.crop' : 'theatermasks.circle'" />
        </view>
        <text class="rank-empty__title">{{ view === 'artist-times' ? '无阵容统计信息' : '无剧目/主题统计信息' }}</text>
      </view>
    </view>

    <view
      v-else
      class="rank-detail"
      :aria-label="isPlayExpense ? '剧目主题花费排行列表' : '阵容花费排行列表'"
    >
      <view class="expense-dimension-section">
        <text class="rank-section__title">可切换不同维度查看</text>
        <view class="expense-dimension-card">
          <button
            class="expense-dimension-picker"
            :aria-label="`切换花费排行维度，当前${selectedExpenseMetricLabel}`"
            @tap="selectExpenseMetric"
          >
            <text class="expense-dimension-picker__label">{{ selectedExpenseMetricLabel }}</text>
            <view class="expense-dimension-picker__chevron"><AppIcon name="chevron" /></view>
          </button>
          <text class="expense-dimension-total">{{ expenseSummaryLabel }}</text>
        </view>
      </view>

      <template v-if="currentExpenses.length">
        <section
          v-for="group in currentExpenses"
          :key="group.currency"
          class="expense-rank-group"
          :aria-label="`${group.currency}${isPlayExpense ? '剧目主题' : '阵容'}花费排行`"
        >
          <view v-if="currentExpenses.length > 1" class="expense-rank-heading">
            <text class="expense-rank-heading__currency">{{ group.currency }}</text>
            <text class="expense-rank-heading__total">
              总计 {{ displayAmount(group.totals[expenseMetric]) }}
            </text>
          </view>

          <text class="rank-subsection-title">🏆 TOP {{ Math.min(3, group.entries.length) }}</text>
          <view class="rank-list-card">
            <button
              v-for="(entry, index) in group.entries.slice(0, 3)"
              :key="entry.name"
              class="rank-row rank-row--expense"
              :class="{ 'rank-row--separated': index > 0 }"
              :aria-label="`第${index + 1}名${entry.name}，花费${displayAmount(imprintExpenseMetricValue(entry, expenseMetric))}，查看统计详情`"
              hover-class="rank-row--pressed"
              @tap="selectExpenseEntry(entry.name)"
            >
              <text class="rank-row__position">{{ positionLabel(index) }}</text>
              <view class="rank-row__expense-copy">
                <view class="rank-row__expense-line">
                  <text class="rank-row__name">{{ entry.name }}</text>
                  <text class="rank-row__primary">
                    {{ displayAmount(imprintExpenseMetricValue(entry, expenseMetric)) }}
                  </text>
                </view>
                <view class="rank-row__expense-line rank-row__secondary">
                  <text>✘{{ entry.times }} 场</text>
                  <text>{{ formatImprintPercentage(imprintExpenseMetricValue(entry, expenseMetric), group.totals[expenseMetric]) }}</text>
                </view>
              </view>
              <view class="rank-row__chevron"><AppIcon name="chevron" /></view>
            </button>
          </view>

          <template v-if="group.entries.length > 3">
            <text class="rank-subsection-title rank-subsection-title--more">更多 +{{ group.entries.length - 3 }}</text>
            <view class="rank-list-card">
              <button
                v-for="(entry, offset) in group.entries.slice(3)"
                :key="entry.name"
                class="rank-row rank-row--expense rank-row--compact"
                :class="{ 'rank-row--separated': offset > 0 }"
                :aria-label="`第${offset + 4}名${entry.name}，花费${displayAmount(imprintExpenseMetricValue(entry, expenseMetric))}，查看统计详情`"
                hover-class="rank-row--pressed"
                @tap="selectExpenseEntry(entry.name)"
              >
                <text class="rank-row__position">{{ offset + 4 }}.</text>
                <view class="rank-row__expense-copy">
                  <view class="rank-row__expense-line">
                    <text class="rank-row__name">{{ entry.name }}</text>
                    <text class="rank-row__primary">
                      {{ displayAmount(imprintExpenseMetricValue(entry, expenseMetric)) }}
                    </text>
                  </view>
                  <view class="rank-row__expense-line rank-row__secondary">
                    <text>✘{{ entry.times }} 场</text>
                    <text>{{ formatImprintPercentage(imprintExpenseMetricValue(entry, expenseMetric), group.totals[expenseMetric]) }}</text>
                  </view>
                </view>
                <view class="rank-row__chevron"><AppIcon name="chevron" /></view>
              </button>
            </view>
          </template>
        </section>
      </template>

      <view v-else class="rank-empty">
        <view class="rank-empty__icon"><AppIcon name="dollarsign.circle" /></view>
        <text class="rank-empty__title">
          {{ isPlayExpense ? '无剧目/主题花费统计信息' : '无阵容花费统计信息' }}
        </text>
      </view>
    </view>
  </scroll-view>
</template>

<style scoped>
.ranks-scroll { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 132rpx - env(safe-area-inset-bottom)); }
.ranks-overview, .rank-detail { padding: 26rpx 24rpx 70rpx; }
.rank-section + .rank-section { margin-top: 30rpx; }
.rank-section__title, .rank-subsection-title { display: block; padding: 0 10rpx 10rpx; color: var(--color-muted); font-size: 22rpx; font-weight: 590; }
.rank-section__card, .overview-row, .rank-list-card { overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.overview-row { display: flex; width: 100%; min-height: 82rpx; margin: 0; padding: 0 21rpx; align-items: center; border: var(--app-border-width) solid var(--color-border); color: var(--color-accent); font-size: 27rpx; line-height: normal; text-align: left; }
.rank-section__card .overview-row { border: 0; border-radius: 0; }
.overview-row::after, .rank-row::after, .expense-dimension-picker::after { border: 0; }
.overview-row--static { cursor: default; }
.overview-row--pressed, .rank-row--pressed { background: var(--color-row-pressed); }
.overview-row--separated { border-top: var(--app-border-width) solid var(--color-border-subtle) !important; }
.overview-row__icon { width: 34rpx; height: 34rpx; flex: none; }
.overview-row__label { margin-left: 18rpx; color: var(--color-text); font-weight: 560; }
.overview-row__value { margin-left: auto; color: var(--color-accent); font-variant-numeric: tabular-nums; font-weight: 650; }
.overview-row__chevron, .rank-row__chevron { width: 22rpx; height: 22rpx; flex: none; color: var(--color-muted); opacity: .72; }
.overview-row__chevron { margin-left: auto; }
.rank-row__chevron { margin-left: 14rpx; }
.rank-detail { min-height: 100%; }
.rank-subsection-title { padding-top: 3rpx; color: var(--color-accent); }
.rank-subsection-title--more { margin-top: 28rpx; color: var(--color-muted); }
.rank-list-card { border-radius: 18rpx; }
.rank-row { display: flex; width: 100%; min-height: 88rpx; margin: 0; padding: 18rpx 18rpx; align-items: center; border: 0; border-radius: 0; background: var(--color-surface); color: var(--color-text); font-size: 26rpx; line-height: 1.3; text-align: left; }
.rank-row--separated { border-top: var(--app-border-width) solid var(--color-border-subtle); }
.rank-row--compact { min-height: 78rpx; font-size: 24rpx; }
.rank-row__position { width: 54rpx; flex: none; color: var(--color-muted); font-variant-numeric: tabular-nums; }
.rank-row__name { min-width: 0; overflow: hidden; flex: 1; font-weight: 560; text-overflow: ellipsis; white-space: nowrap; }
.rank-row__primary { flex: none; margin-left: 16rpx; color: var(--color-accent); font-variant-numeric: tabular-nums; font-weight: 630; }
.rank-empty { display: flex; min-height: 58vh; flex-direction: column; align-items: center; justify-content: center; color: var(--color-muted); text-align: center; }
.rank-empty__icon { width: 68rpx; height: 68rpx; color: var(--color-accent); opacity: .58; }
.rank-empty__title { margin-top: 20rpx; font-size: 27rpx; font-weight: 620; }
.expense-dimension-section { margin: -2rpx 0 26rpx; }
.expense-dimension-card { display: flex; min-height: 82rpx; padding: 0 20rpx 0 8rpx; align-items: center; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.expense-dimension-picker { display: flex; min-width: 0; min-height: 70rpx; margin: 0; padding: 0 12rpx; align-items: center; border: 0; background: transparent; color: var(--color-accent); font-size: 25rpx; line-height: normal; text-align: left; }
.expense-dimension-picker__label { overflow: hidden; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.expense-dimension-picker__chevron { width: 20rpx; height: 20rpx; margin-left: 8rpx; flex: none; color: var(--color-muted); transform: rotate(90deg); }
.expense-dimension-total { overflow: hidden; margin-left: auto; flex: none; color: var(--color-accent); font-size: 24rpx; font-variant-numeric: tabular-nums; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.expense-rank-group + .expense-rank-group { margin-top: 38rpx; padding-top: 28rpx; border-top: var(--app-border-width) solid var(--color-border); }
.expense-rank-heading { display: flex; margin-bottom: 18rpx; padding: 0 10rpx; align-items: baseline; justify-content: space-between; gap: 18rpx; }
.expense-rank-heading__currency { color: var(--color-text); font-size: 29rpx; font-weight: 680; }
.expense-rank-heading__total { overflow: hidden; color: var(--color-accent); font-size: 24rpx; font-variant-numeric: tabular-nums; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.rank-row--expense { min-height: 104rpx; align-items: flex-start; }
.rank-row__expense-copy { min-width: 0; flex: 1; }
.rank-row__expense-line { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 18rpx; }
.rank-row__expense-line .rank-row__primary { margin-left: 0; }
.rank-row__secondary { margin-top: 8rpx; color: var(--color-muted); font-size: 21rpx; font-variant-numeric: tabular-nums; }
.rank-row--expense .rank-row__chevron { align-self: center; }
</style>
