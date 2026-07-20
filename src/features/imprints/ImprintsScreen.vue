<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  buildMonthCalendar,
  formatAggregatedAmount,
  ImprintQueryService,
  localDateKey,
  summarizeImprintYear,
  type ImprintCalendarCell,
  type ImprintRankEntry,
} from '@/features/imprints/model'
import PerformanceCard from '@/features/performances/PerformanceCard.vue'
import { formatPerformanceDate } from '@/features/performances/browser'
import { getAppRepositories } from '@/platform/repositories/context'

const props = defineProps<{
  theme: 'light' | 'dark'
  refreshKey: number
}>()

const emit = defineEmits<{
  open: [id: string]
}>()

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonthIndex = ref(now.getMonth())
const selectedDateMs = ref(startOfLocalDay(now.getTime()))
const performances = ref<Performance[]>([])
const years = ref<number[]>([now.getFullYear()])
const loading = ref(true)
let requestSequence = 0

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const calendarCells = computed(() => buildMonthCalendar(
  selectedYear.value,
  selectedMonthIndex.value,
  performances.value,
  selectedDateMs.value,
))
const monthPerformances = computed(() => calendarCells.value
  .filter(({ inCurrentMonth }) => inCurrentMonth)
  .flatMap(({ performances: items }) => items))
const selectedDayPerformances = computed(() =>
  calendarCells.value.find(({ isSelected }) => isSelected)?.performances ?? [])
const annualSummary = computed(() => summarizeImprintYear(selectedYear.value, performances.value))
const headerCount = computed(() => `${annualSummary.value.total} 场 · ${selectedYear.value}`)
const monthTitle = computed(() => `${selectedYear.value}年 ${selectedMonthIndex.value + 1}月`)
const selectedDayTitle = computed(() => `${formatPerformanceDate(selectedDateMs.value)} · ${selectedDayPerformances.value.length} 场`)
const selectedYearIndex = computed(() => Math.max(0, years.value.indexOf(selectedYear.value)))
const rankingSections = computed(() => [
  { title: '城市排行', description: `${annualSummary.value.cityCount} 个城市`, items: annualSummary.value.cityRanking },
  { title: '阵容排行', description: `${annualSummary.value.artistCount} 组阵容`, items: annualSummary.value.artistRanking },
  { title: '剧目排行', description: `${annualSummary.value.playCount} 部剧目`, items: annualSummary.value.playRanking },
].filter(({ items }) => items.length > 0))

onMounted(load)
watch(() => props.refreshKey, load)

async function load(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    const snapshot = await new ImprintQueryService(repositories.performances).loadSnapshot()
    if (sequence !== requestSequence) return
    performances.value = snapshot.performances
    years.value = snapshot.years
    if (!years.value.includes(selectedYear.value)) selectedYear.value = years.value[0] ?? now.getFullYear()
  } catch (error) {
    if (sequence !== requestSequence) return
    uni.showToast({
      title: error instanceof Error ? error.message : '加载印记失败',
      icon: 'none',
    })
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function changeMonth(offset: number): void {
  const date = new Date(selectedYear.value, selectedMonthIndex.value + offset, 1)
  selectedYear.value = date.getFullYear()
  selectedMonthIndex.value = date.getMonth()
  selectedDateMs.value = date.getTime()
  ensureYearOption(selectedYear.value)
}

function selectDay(cell: ImprintCalendarCell): void {
  const date = new Date(cell.dateMs)
  selectedYear.value = date.getFullYear()
  selectedMonthIndex.value = date.getMonth()
  selectedDateMs.value = cell.dateMs
  ensureYearOption(selectedYear.value)
}

function selectYear(event: { detail: { value: string | number } }): void {
  const index = Number(event.detail.value)
  const year = years.value[index]
  if (!year) return
  selectedYear.value = year
  selectedDateMs.value = new Date(year, selectedMonthIndex.value, 1).getTime()
}

function resetToCurrentMonth(): void {
  const date = new Date()
  selectedYear.value = date.getFullYear()
  selectedMonthIndex.value = date.getMonth()
  selectedDateMs.value = startOfLocalDay(date.getTime())
  ensureYearOption(selectedYear.value)
}

function ensureYearOption(year: number): void {
  if (!years.value.includes(year)) years.value = [...years.value, year].sort((left, right) => right - left)
}

function calendarCellLabel(cell: ImprintCalendarCell): string {
  const date = new Date(cell.dateMs)
  const count = cell.count ? `，${cell.count} 场演出` : '，无演出'
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${count}`
}

function rankTop(items: readonly ImprintRankEntry[]): ImprintRankEntry[] {
  return items.slice(0, 5)
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
</script>

<template>
  <view class="imprints-screen">
    <AppHeader title="印记" :count="headerCount" />

    <view v-if="loading" class="loading-state">正在整理演出印记…</view>
    <scroll-view v-else class="imprints-scroll" scroll-y>
      <view class="imprints-content">
        <section class="surface calendar-section" aria-label="月历印记">
          <view class="calendar-toolbar">
            <button class="month-arrow" aria-label="上个月" @tap="changeMonth(-1)">
              <AppIcon name="arrow-left" />
            </button>
            <view class="calendar-title-group">
              <text class="calendar-title">{{ monthTitle }}</text>
              <text class="calendar-count">{{ monthPerformances.length }} 场演出</text>
            </view>
            <button class="month-arrow month-arrow--next" aria-label="下个月" @tap="changeMonth(1)">
              <AppIcon name="arrow-left" />
            </button>
          </view>

          <view class="calendar-secondary">
            <picker
              mode="selector"
              :range="years"
              :value="selectedYearIndex"
              @change="selectYear"
            >
              <view class="year-picker" aria-label="选择统计年份">选择年份</view>
            </picker>
            <button class="today-button" @tap="resetToCurrentMonth">回到今天</button>
          </view>

          <view class="weekday-grid" aria-hidden="true">
            <text v-for="weekday in weekdays" :key="weekday" class="weekday">{{ weekday }}</text>
          </view>
          <view class="calendar-grid" aria-label="42 格月历">
            <button
              v-for="cell in calendarCells"
              :key="localDateKey(cell.dateMs)"
              class="calendar-cell"
              :class="{
                'calendar-cell--outside': !cell.inCurrentMonth,
                'calendar-cell--today': cell.isToday,
                'calendar-cell--selected': cell.isSelected,
                'calendar-cell--has-events': cell.count > 0,
              }"
              :aria-label="calendarCellLabel(cell)"
              @tap="selectDay(cell)"
            >
              <text class="calendar-cell__day">{{ cell.day }}</text>
              <view v-if="cell.count" class="calendar-cell__event">
                <view v-if="cell.hasPoster" class="calendar-cell__poster" />
                <text>{{ cell.count }}场</text>
              </view>
              <view v-else-if="cell.isToday" class="calendar-cell__today-dot" />
            </button>
          </view>
        </section>

        <section class="surface day-section" aria-label="所选日期演出">
          <view class="section-heading">
            <view>
              <text class="section-kicker">所选日期</text>
              <text class="section-title">{{ selectedDayTitle }}</text>
            </view>
          </view>
          <view v-if="selectedDayPerformances.length" class="day-list">
            <PerformanceCard
              v-for="performance in selectedDayPerformances"
              :key="performance.id"
              :performance="performance"
              mode="card"
              @open="$emit('open', $event)"
            />
          </view>
          <view v-else class="day-empty">
            <view class="day-empty__icon"><AppIcon name="calendar" /></view>
            <text>这一天还没有演出记录</text>
          </view>
        </section>

        <section class="surface annual-section" aria-label="年度统计">
          <view class="section-heading section-heading--annual">
            <view>
              <text class="section-kicker">年度回顾</text>
              <text class="section-title">{{ selectedYear }} 年印记</text>
            </view>
            <text class="annual-days">{{ annualSummary.uniqueDays }} 个观演日</text>
          </view>

          <view class="stat-grid">
            <view class="stat-card stat-card--accent">
              <text class="stat-card__value">{{ annualSummary.total }}</text>
              <text class="stat-card__label">场演出</text>
            </view>
            <view class="stat-card">
              <text class="stat-card__value">{{ annualSummary.lifecycleCounts.attended }}</text>
              <text class="stat-card__label">场已看</text>
            </view>
            <view class="stat-card">
              <text class="stat-card__value">{{ annualSummary.cityCount }}</text>
              <text class="stat-card__label">个城市</text>
            </view>
            <view class="stat-card">
              <text class="stat-card__value">{{ annualSummary.artistCount }}</text>
              <text class="stat-card__label">组阵容</text>
            </view>
          </view>

          <view class="summary-chips">
            <text v-if="annualSummary.lifecycleCounts.upcoming" class="summary-chip">待看 {{ annualSummary.lifecycleCounts.upcoming }}</text>
            <text v-if="annualSummary.lifecycleCounts['pending-sale']" class="summary-chip">待开票 {{ annualSummary.lifecycleCounts['pending-sale'] }}</text>
            <text v-if="annualSummary.lifecycleCounts.cancelled" class="summary-chip">已取消 {{ annualSummary.lifecycleCounts.cancelled }}</text>
            <text v-if="annualSummary.lifecycleCounts.missed" class="summary-chip">未赴约 {{ annualSummary.lifecycleCounts.missed }}</text>
            <text v-if="annualSummary.averageRating !== null" class="summary-chip">平均评分 {{ annualSummary.averageRating.toFixed(1) }}</text>
          </view>
        </section>

        <section v-if="annualSummary.expenses.length" class="surface expense-section" aria-label="年度消费">
          <view class="section-heading">
            <view>
              <text class="section-kicker">消费</text>
              <text class="section-title">按币种分别汇总</text>
            </view>
          </view>
          <view class="expense-list">
            <view v-for="expense in annualSummary.expenses" :key="expense.currency" class="expense-row">
              <view class="expense-main">
                <text class="expense-currency">{{ expense.currency }}</text>
                <text class="expense-total">{{ formatAggregatedAmount(expense.totalCost) }}</text>
              </view>
              <text class="expense-caption">总消费 = 实付 {{ formatAggregatedAmount(expense.paidPrice) }} + 其他 {{ formatAggregatedAmount(expense.otherCost) }}</text>
              <text class="expense-caption">票面价 {{ formatAggregatedAmount(expense.ticketPrice) }}</text>
            </view>
          </view>
        </section>

        <section v-if="rankingSections.length" class="surface ranking-section" aria-label="年度排行">
          <view class="section-heading">
            <view>
              <text class="section-kicker">聚合排行</text>
              <text class="section-title">城市与阵容足迹</text>
            </view>
          </view>
          <view class="ranking-groups">
            <view v-for="group in rankingSections" :key="group.title" class="ranking-group">
              <view class="ranking-group__heading">
                <text class="ranking-group__title">{{ group.title }}</text>
                <text class="ranking-group__description">{{ group.description }}</text>
              </view>
              <view class="ranking-list">
                <view v-for="(item, index) in rankTop(group.items)" :key="item.name" class="ranking-row">
                  <text class="ranking-index">{{ index + 1 }}</text>
                  <text class="ranking-name">{{ item.name }}</text>
                  <text class="ranking-count">{{ item.count }} 场</text>
                </view>
              </view>
            </view>
          </view>
        </section>

        <view v-if="performances.length === 0" class="imprints-empty">
          <view class="imprints-empty__icon"><AppIcon name="calendar" /></view>
          <text class="imprints-empty__title">还没有可以回顾的印记</text>
          <text class="imprints-empty__description">完成演出记录后，时间、消费与足迹会在这里慢慢展开</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.imprints-screen { min-height: 100vh; background: var(--color-background); }
.loading-state { display: flex; min-height: calc(100vh - 368rpx); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.imprints-scroll { box-sizing: border-box; height: calc(100vh - 236rpx - 132rpx - env(safe-area-inset-bottom)); }
.imprints-content { display: flex; padding: 24rpx 24rpx 64rpx; flex-direction: column; gap: 22rpx; }
.surface { box-sizing: border-box; padding: 26rpx; border: 1rpx solid var(--color-border); border-radius: 24rpx; background: var(--color-surface); box-shadow: 0 8rpx 26rpx var(--color-tab-shadow); }
.calendar-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.month-arrow, .today-button { margin: 0; padding: 0; border: 0; background: transparent; }
.month-arrow::after, .today-button::after { border: 0; }
.month-arrow { box-sizing: border-box; display: flex; width: 64rpx; height: 64rpx; padding: 17rpx; align-items: center; justify-content: center; border-radius: 18rpx; color: var(--color-accent); }
.month-arrow--next { transform: rotate(180deg); }
.calendar-title-group { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: center; }
.calendar-title { color: var(--color-text); font-size: 32rpx; font-weight: 720; }
.calendar-count { margin-top: 4rpx; color: var(--color-muted); font-size: 22rpx; }
.calendar-secondary { display: flex; margin: 20rpx 2rpx 18rpx; align-items: center; justify-content: space-between; }
.year-picker, .today-button { color: var(--color-accent); font-size: 23rpx; font-weight: 600; line-height: 52rpx; }
.year-picker { padding: 0 16rpx; border-radius: 14rpx; background: var(--color-accent-soft); }
.today-button { height: 52rpx; }
.weekday-grid, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekday-grid { margin-bottom: 8rpx; }
.weekday { color: var(--color-muted); font-size: 21rpx; font-weight: 650; text-align: center; }
.calendar-grid { gap: 6rpx; }
.calendar-cell { box-sizing: border-box; display: flex; min-width: 0; height: 82rpx; margin: 0; padding: 9rpx 2rpx 7rpx; flex-direction: column; align-items: center; justify-content: space-between; border: 1rpx solid transparent; border-radius: 14rpx; background: transparent; color: var(--color-text); line-height: 1; }
.calendar-cell::after { border: 0; }
.calendar-cell--outside { opacity: .38; }
.calendar-cell--has-events { background: var(--color-accent-soft); color: var(--color-accent); }
.calendar-cell--today { border-color: var(--color-accent-border); }
.calendar-cell--selected { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-on-accent); opacity: 1; }
.calendar-cell__day { font-size: 23rpx; font-weight: 650; }
.calendar-cell__event { display: flex; min-width: 0; align-items: center; gap: 4rpx; font-size: 17rpx; font-weight: 650; }
.calendar-cell__poster { width: 7rpx; height: 12rpx; flex: none; border-radius: 2rpx; background: currentColor; opacity: .78; }
.calendar-cell__today-dot { width: 6rpx; height: 6rpx; border-radius: 50%; background: currentColor; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.section-heading > view:first-child { display: flex; min-width: 0; flex-direction: column; }
.section-kicker { color: var(--color-accent); font-size: 21rpx; font-weight: 680; letter-spacing: 1rpx; }
.section-title { margin-top: 7rpx; color: var(--color-text); font-size: 30rpx; font-weight: 720; }
.day-list { display: flex; margin-top: 22rpx; flex-direction: column; gap: 16rpx; }
.day-empty { display: flex; min-height: 150rpx; margin-top: 18rpx; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; color: var(--color-muted); font-size: 23rpx; }
.day-empty__icon { width: 42rpx; height: 42rpx; color: var(--color-accent); opacity: .66; }
.section-heading--annual { align-items: center; }
.annual-days { flex: none; color: var(--color-muted); font-size: 22rpx; }
.stat-grid { display: grid; margin-top: 24rpx; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10rpx; }
.stat-card { display: flex; min-width: 0; padding: 18rpx 4rpx; flex-direction: column; align-items: center; border-radius: 18rpx; background: var(--color-accent-soft); }
.stat-card--accent { background: var(--color-accent); }
.stat-card__value { color: var(--color-accent); font-size: 34rpx; font-weight: 760; }
.stat-card--accent .stat-card__value, .stat-card--accent .stat-card__label { color: var(--color-on-accent); }
.stat-card__label { margin-top: 5rpx; color: var(--color-muted); font-size: 19rpx; white-space: nowrap; }
.summary-chips { display: flex; margin-top: 18rpx; flex-wrap: wrap; gap: 9rpx; }
.summary-chip { padding: 8rpx 13rpx; border-radius: 16rpx; background: var(--color-row-pressed); color: var(--color-muted); font-size: 20rpx; }
.expense-list, .ranking-groups { display: flex; margin-top: 22rpx; flex-direction: column; gap: 16rpx; }
.expense-row { padding: 20rpx; border-radius: 18rpx; background: var(--color-accent-soft); }
.expense-main { display: flex; align-items: baseline; justify-content: space-between; gap: 20rpx; }
.expense-currency { color: var(--color-accent); font-size: 23rpx; font-weight: 760; letter-spacing: 1rpx; }
.expense-total { color: var(--color-text); font-size: 34rpx; font-weight: 760; font-variant-numeric: tabular-nums; }
.expense-caption { display: block; margin-top: 8rpx; color: var(--color-muted); font-size: 20rpx; }
.ranking-group { overflow: hidden; border: 1rpx solid var(--color-border-subtle); border-radius: 18rpx; }
.ranking-group__heading { display: flex; padding: 18rpx 20rpx; align-items: center; justify-content: space-between; gap: 16rpx; background: var(--color-accent-soft); }
.ranking-group__title { color: var(--color-text); font-size: 25rpx; font-weight: 700; }
.ranking-group__description { color: var(--color-muted); font-size: 20rpx; }
.ranking-list { display: flex; flex-direction: column; }
.ranking-row { display: flex; min-height: 68rpx; padding: 0 20rpx; align-items: center; gap: 14rpx; border-top: 1rpx solid var(--color-border-subtle); }
.ranking-row:first-child { border-top: 0; }
.ranking-index { display: flex; width: 34rpx; height: 34rpx; align-items: center; justify-content: center; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); font-size: 19rpx; font-weight: 720; }
.ranking-name { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text); font-size: 23rpx; text-overflow: ellipsis; white-space: nowrap; }
.ranking-count { flex: none; color: var(--color-muted); font-size: 21rpx; }
.imprints-empty { display: flex; padding: 50rpx 30rpx 24rpx; flex-direction: column; align-items: center; text-align: center; }
.imprints-empty__icon { width: 76rpx; height: 76rpx; color: var(--color-accent); opacity: .62; }
.imprints-empty__title { margin-top: 20rpx; color: var(--color-text); font-size: 29rpx; font-weight: 680; }
.imprints-empty__description { max-width: 540rpx; margin-top: 10rpx; color: var(--color-muted); font-size: 23rpx; line-height: 1.5; }

@media (min-width: 600px) {
  .calendar-cell { height: 90rpx; }
}
</style>
