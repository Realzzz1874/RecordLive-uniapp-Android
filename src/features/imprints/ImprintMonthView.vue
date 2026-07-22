<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  buildMonthCalendar,
  formatAggregatedAmount,
  localDateKey,
  seedImprintDateTime,
  shiftImprintMonth,
  summarizeImprintYear,
  type ImprintCalendarCell,
} from '@/features/imprints/model'
import {
  artistIntensityLevel,
  computeArtistSummary,
} from '@/features/performances/artist-summary'
import { performanceMediaPath } from '@/features/performances/browser'

const props = defineProps<{
  performances: Performance[]
  alwaysShowDate: boolean
  showPerformanceTime: boolean
  showExpenseAmounts: boolean
}>()

const emit = defineEmits<{
  add: [startedAtMs: number]
  open: [id: string]
  'toggle-expense-amounts': []
}>()

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonthIndex = ref(now.getMonth())
const selectedDateMs = ref(startOfLocalDay(now.getTime()))
const calendarSwipeOffset = ref(0)
const calendarSwipeTransition = ref(false)
let swipeStartX = 0
let swipeStartY = 0
let swipeLastX = 0
let swipeLastY = 0
let swipeHorizontal = false
let ignoreNextDayTap = false
let ignoreTapTimer: ReturnType<typeof setTimeout> | undefined

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const monthOptions = Array.from({ length: 12 }, (_, index) => `${index + 1}月`)
const calendarCells = computed(() => buildMonthCalendar(
  selectedYear.value,
  selectedMonthIndex.value,
  props.performances,
  selectedDateMs.value,
))
const visibleCalendarCells = computed(() => calendarCells.value.filter(({ inCurrentMonth }) => inCurrentMonth))
const calendarStartColumn = computed(() => String((new Date(
  selectedYear.value,
  selectedMonthIndex.value,
  1,
).getDay() + 6) % 7 + 1))
const monthPerformances = computed(() => calendarCells.value
  .filter(({ inCurrentMonth }) => inCurrentMonth)
  .flatMap(({ performances }) => performances))
const monthSummary = computed(() => summarizeImprintYear(selectedYear.value, monthPerformances.value))
const pickerYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const values = new Set(Array.from({ length: 41 }, (_, index) => currentYear - 30 + index))
  values.add(selectedYear.value)
  for (const performance of props.performances) values.add(new Date(performance.startedAtMs).getFullYear())
  return [...values].sort((left, right) => left - right)
})
const pickerRanges = computed(() => [pickerYears.value.map((year) => `${year}年`), monthOptions])
const pickerValue = computed(() => [
  Math.max(0, pickerYears.value.indexOf(selectedYear.value)),
  selectedMonthIndex.value,
])
const monthTitle = computed(() => `${selectedYear.value}-${String(selectedMonthIndex.value + 1).padStart(2, '0')}`)
const calendarStyle = computed(() => ({ transform: `translateX(${calendarSwipeOffset.value}px)` }))
const artistRanking = computed(() => computeArtistSummary(monthPerformances.value, 'times'))
const todayMemories = computed(() => {
  const today = new Date()
  if (selectedYear.value !== today.getFullYear() || selectedMonthIndex.value !== today.getMonth()) return []
  return props.performances
    .filter(({ startedAtMs }) => {
      const date = new Date(startedAtMs)
      return date.getFullYear() !== today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate()
    })
    .sort((left, right) => right.startedAtMs - left.startedAtMs)
})

onBeforeUnmount(() => clearTimeout(ignoreTapTimer))

function changeMonth(offset: number): void {
  const next = shiftImprintMonth(selectedYear.value, selectedMonthIndex.value, offset)
  selectedYear.value = next.year
  selectedMonthIndex.value = next.monthIndex
  selectedDateMs.value = new Date(next.year, next.monthIndex, 1).getTime()
}

function resetToCurrentMonth(): void {
  const date = new Date()
  selectedYear.value = date.getFullYear()
  selectedMonthIndex.value = date.getMonth()
  selectedDateMs.value = startOfLocalDay(date.getTime())
}

function selectYearAndMonth(event: { detail: { value: Array<string | number> } }): void {
  const [yearIndexValue, monthIndexValue] = event.detail.value
  const year = pickerYears.value[Number(yearIndexValue)]
  const monthIndex = Number(monthIndexValue)
  if (year === undefined || monthIndex < 0 || monthIndex > 11) return
  selectedYear.value = year
  selectedMonthIndex.value = monthIndex
  selectedDateMs.value = new Date(year, monthIndex, 1).getTime()
}

function handleDay(cell: ImprintCalendarCell): void {
  if (ignoreNextDayTap || !cell.inCurrentMonth) return
  selectedDateMs.value = cell.dateMs
  if (!cell.performances.length) {
    emit('add', seedImprintDateTime(cell.dateMs))
    return
  }

  uni.showActionSheet({
    title: `${selectedYear.value}年${selectedMonthIndex.value + 1}月${cell.day}日`,
    itemList: [
      '添加演出',
      ...cell.performances.map((performance) => `${formatTime(performance.startedAtMs)} ${performance.name}`),
    ],
    success: ({ tapIndex }) => {
      if (tapIndex === 0) {
        emit('add', seedImprintDateTime(cell.dateMs))
        return
      }
      const performance = cell.performances[tapIndex - 1]
      if (performance) emit('open', performance.id)
    },
  })
}

function handleTouchStart(event: TouchEvent): void {
  const touch = event.touches[0]
  if (!touch) return
  swipeStartX = touch.clientX
  swipeStartY = touch.clientY
  swipeLastX = touch.clientX
  swipeLastY = touch.clientY
  swipeHorizontal = false
  calendarSwipeTransition.value = false
}

function handleTouchMove(event: TouchEvent): void {
  const touch = event.touches[0]
  if (!touch) return
  swipeLastX = touch.clientX
  swipeLastY = touch.clientY
  const horizontal = swipeLastX - swipeStartX
  const vertical = swipeLastY - swipeStartY
  if (Math.abs(horizontal) < 12 || Math.abs(horizontal) <= Math.abs(vertical) * 1.2) return
  swipeHorizontal = true
  calendarSwipeOffset.value = Math.max(-42, Math.min(42, horizontal * 0.35))
}

function handleTouchEnd(): void {
  const horizontal = swipeLastX - swipeStartX
  const vertical = swipeLastY - swipeStartY
  const shouldSwitch = swipeHorizontal
    && Math.abs(horizontal) > 60
    && Math.abs(horizontal) > Math.abs(vertical) * 1.2

  if (shouldSwitch) {
    changeMonth(horizontal < 0 ? 1 : -1)
    ignoreNextDayTap = true
    clearTimeout(ignoreTapTimer)
    ignoreTapTimer = setTimeout(() => { ignoreNextDayTap = false }, 220)
  }
  calendarSwipeTransition.value = true
  calendarSwipeOffset.value = 0
  swipeHorizontal = false
}

function performancePoster(performance: Performance): string {
  return performanceMediaPath(performance, 'poster')
}

function cellLabel(cell: ImprintCalendarCell): string {
  const date = new Date(cell.dateMs)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日，${cell.count ? `${cell.count}场演出` : '无演出，点击添加'}`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
</script>

<template>
  <scroll-view class="month-scroll" scroll-y>
    <view class="month-content">
      <section class="month-calendar" aria-label="月历印记">
        <view class="month-toolbar">
          <view class="month-toolbar__summary">
            <picker
              mode="multiSelector"
              :range="pickerRanges"
              :value="pickerValue"
              @change="selectYearAndMonth"
            >
              <view class="month-picker" aria-label="选择年月">
                <text>{{ monthTitle }}</text>
                <view class="month-picker__chevron"><AppIcon name="chevron" /></view>
              </view>
            </picker>
            <text class="month-count">✘ {{ monthPerformances.length }} 场</text>
          </view>
          <view class="month-toolbar__actions">
            <button class="month-action" aria-label="回到本月" @tap="resetToCurrentMonth"><AppIcon name="arrow.counterclockwise.square" /></button>
            <button class="month-action" aria-label="上个月" @tap="changeMonth(-1)"><AppIcon name="arrow.left.square" /></button>
            <button class="month-action" aria-label="下个月" @tap="changeMonth(1)"><AppIcon name="arrow.right.square" /></button>
          </view>
        </view>

        <view class="weekday-grid" aria-hidden="true">
          <text v-for="weekday in weekdays" :key="weekday" class="weekday">{{ weekday }}</text>
        </view>

        <view class="calendar-viewport">
          <view
            class="calendar-grid"
            :class="{ 'calendar-grid--settling': calendarSwipeTransition }"
            :style="calendarStyle"
            :aria-label="`${visibleCalendarCells.length}天月历`"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @touchcancel="handleTouchEnd"
          >
            <button
              v-for="(cell, index) in visibleCalendarCells"
              :key="localDateKey(cell.dateMs)"
              class="calendar-cell"
              :class="{
                'calendar-cell--today': cell.isToday,
                'calendar-cell--selected': cell.isSelected,
                'calendar-cell--event': cell.count > 0,
                'calendar-cell--multiple': cell.count > 1,
                'calendar-cell--date-visible': cell.count > 0 && alwaysShowDate,
                'calendar-cell--time-visible': cell.count > 0 && showPerformanceTime,
              }"
              :style="index === 0 ? { gridColumnStart: calendarStartColumn } : undefined"
              :aria-label="cellLabel(cell)"
              @tap="handleDay(cell)"
            >
              <view v-if="cell.count" class="calendar-cell__events">
                <view
                  v-for="performance in cell.performances"
                  :key="performance.id"
                  class="calendar-cell__event-slice"
                >
                  <image
                    v-if="performancePoster(performance)"
                    class="calendar-cell__image"
                    :src="performancePoster(performance)"
                    mode="aspectFill"
                  />
                  <view v-else class="calendar-cell__fallback">
                    <text>{{ performance.name }}</text>
                  </view>
                  <text v-if="showPerformanceTime" class="calendar-cell__time">{{ formatTime(performance.startedAtMs) }}</text>
                </view>
              </view>
              <text v-else class="calendar-cell__empty-day">{{ cell.isToday ? '今' : cell.day }}</text>
              <text v-if="cell.count && alwaysShowDate" class="calendar-cell__day-overlay">{{ cell.isToday ? '今' : cell.day }}</text>
              <text v-if="cell.count > 1" class="calendar-cell__badge">{{ cell.count }}</text>
            </button>
          </view>
        </view>

        <text v-if="!monthPerformances.length" class="month-empty-tip">本月暂无演出，点击日期即可添加</text>
      </section>

      <section v-if="todayMemories.length" class="month-summary" aria-label="那年今日">
        <view class="summary-heading">
          <view class="summary-heading__icon"><AppIcon name="sparkles" /></view>
          <text>那年今日</text>
        </view>
        <button
          v-for="performance in todayMemories"
          :key="performance.id"
          class="memory-row"
          :aria-label="`查看${performance.name}`"
          @tap="$emit('open', performance.id)"
        >
          <text class="memory-row__date">{{ new Date(performance.startedAtMs).getFullYear() }} · {{ formatTime(performance.startedAtMs) }}</text>
          <text class="memory-row__name">{{ performance.name }}</text>
        </button>
      </section>

      <section v-if="monthSummary.expenses.length" class="month-summary month-summary--expense" aria-label="月度花费">
        <view class="summary-heading summary-heading--with-action">
          <view class="summary-heading__title">
            <view class="summary-heading__icon"><AppIcon name="dollarsign.circle" /></view>
            <text>花费{{ monthSummary.expenses.length === 1 ? `(${monthSummary.expenses[0]?.currency})` : '' }}</text>
          </view>
          <button
            class="summary-heading__action"
            :aria-label="showExpenseAmounts ? '隐藏花费金额' : '显示花费金额'"
            @tap="$emit('toggle-expense-amounts')"
          >
            <AppIcon :name="showExpenseAmounts ? 'eye' : 'eye.slash'" />
          </button>
        </view>
        <view v-for="expense in monthSummary.expenses" :key="expense.currency" class="expense-group">
          <text v-if="monthSummary.expenses.length > 1" class="expense-currency">{{ expense.currency }}</text>
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
      </section>

      <section v-if="artistRanking.length" class="month-summary" aria-label="月度阵容">
        <view class="summary-heading">
          <view class="summary-heading__icon"><AppIcon name="square.on.square.badge.person.crop" /></view>
          <text>阵容</text>
        </view>
        <view class="artist-chips app-chip-list">
          <view
            v-for="artist in artistRanking"
            :key="artist.name"
            class="artist-chip app-chip"
            :class="`app-chip--level-${artistIntensityLevel(artist.times)}`"
            :aria-label="`${artist.name}，共${artist.times}次`"
          >
            <text>{{ artist.name }} ✘{{ artist.times }}</text>
          </view>
        </view>
      </section>
    </view>
  </scroll-view>
</template>

<style scoped>
.month-scroll { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 132rpx - env(safe-area-inset-bottom)); }
.month-content { display: flex; padding: 24rpx 24rpx 64rpx; flex-direction: column; gap: 20rpx; }
.month-calendar { min-width: 0; }
.month-toolbar { display: flex; min-height: 80rpx; padding: 10rpx 12rpx 10rpx 18rpx; align-items: center; justify-content: space-between; gap: 12rpx; border-radius: 10rpx; background: var(--color-accent-soft); color: var(--color-accent); }
.month-toolbar__summary, .month-toolbar__actions, .month-picker { display: flex; align-items: center; }
.month-toolbar__summary { min-width: 0; gap: 12rpx; }
.month-picker { gap: 6rpx; color: var(--color-accent); font-size: 27rpx; font-weight: 720; font-variant-numeric: tabular-nums; }
.month-picker__chevron { width: 22rpx; height: 22rpx; transform: rotate(90deg); }
.month-count { flex: none; color: var(--color-accent); font-size: 27rpx; }
.month-toolbar__actions { flex: none; gap: 2rpx; }
.month-action { display: flex; width: 54rpx; height: 54rpx; margin: 0; padding: 14rpx; align-items: center; justify-content: center; border: 0; border-radius: 13rpx; background: transparent; color: var(--color-accent); }
.month-action::after, .calendar-cell::after, .memory-row::after { border: 0; }
.weekday-grid, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekday-grid { margin: 24rpx 0 12rpx; }
.weekday { color: var(--color-accent); font-size: 21rpx; font-weight: 680; text-align: center; }
.calendar-viewport { overflow: hidden; }
.calendar-grid { gap: 6rpx; touch-action: pan-y; }
.calendar-grid--settling { transition: transform 360ms cubic-bezier(.22,.8,.3,1); }
.calendar-cell { box-sizing: border-box; position: relative; display: flex; min-width: 0; height: auto; aspect-ratio: 3 / 4; margin: 0; padding: 0; align-items: center; justify-content: center; overflow: hidden; border: var(--app-border-width) solid transparent; border-radius: 9rpx; background: var(--color-accent-soft); color: var(--color-on-accent); }
.calendar-cell--today { background: var(--color-accent); }
.calendar-cell--selected { border-color: var(--color-accent-border); box-shadow: inset 0 0 0 2rpx var(--color-background); }
.calendar-cell--event { background: var(--color-accent); }
.calendar-cell__events { display: flex; width: 100%; height: 100%; flex-direction: column; }
.calendar-cell__event-slice { position: relative; min-height: 0; flex: 1 1 0; overflow: hidden; }
.calendar-cell__event-slice + .calendar-cell__event-slice::before { position: absolute; z-index: 2; top: 0; right: 0; left: 0; height: 1rpx; background: rgba(255,255,255,.26); content: ''; }
.calendar-cell__image, .calendar-cell__fallback { width: 100%; height: 100%; }
.calendar-cell__image { display: block; object-position: center; }
.calendar-cell__fallback { display: flex; padding: 8rpx 5rpx; align-items: center; justify-content: center; background: var(--color-accent); }
.calendar-cell--date-visible:not(.calendar-cell--multiple) .calendar-cell__fallback { align-items: flex-start; }
.calendar-cell--date-visible:not(.calendar-cell--multiple) .calendar-cell__fallback text { padding-top: 3rpx; font-size: 15rpx; opacity: .82; -webkit-line-clamp: 2; }
.calendar-cell--multiple .calendar-cell__fallback text { font-size: 14rpx; -webkit-line-clamp: 2; }
.calendar-cell--time-visible .calendar-cell__fallback { padding-bottom: 26rpx; }
.calendar-cell__fallback text { display: -webkit-box; overflow: hidden; color: var(--color-on-accent); font-size: 18rpx; line-height: 1.2; text-align: center; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.calendar-cell__empty-day { color: var(--color-accent); font-size: 24rpx; font-weight: 650; }
.calendar-cell--today .calendar-cell__empty-day { color: var(--color-on-accent); }
.calendar-cell__day-overlay { position: absolute; z-index: 2; top: 50%; left: 50%; color: #fff; font-size: 24rpx; font-weight: 720; line-height: 1; text-shadow: 0 1rpx 5rpx rgba(0,0,0,.72); transform: translate(-50%, -50%); }
.calendar-cell__time { position: absolute; right: 0; bottom: 0; left: 0; padding: 4rpx 1rpx; background: rgba(255,255,255,.84); color: var(--color-accent); font-size: 15rpx; font-weight: 650; line-height: 18rpx; text-align: center; }
.calendar-cell__badge { position: absolute; top: 4rpx; right: 4rpx; display: flex; min-width: 24rpx; height: 24rpx; padding: 0 4rpx; align-items: center; justify-content: center; border-radius: 6rpx; background: rgba(255,255,255,.88); color: #b5473e; font-size: 15rpx; font-weight: 760; line-height: 24rpx; }
.month-empty-tip { display: block; padding: 26rpx 0 4rpx; color: var(--color-muted); font-size: 22rpx; text-align: center; }
.month-summary { padding: 16rpx; border-radius: 20rpx; background: var(--color-secondary-surface); }
.summary-heading { display: flex; min-height: 34rpx; margin-bottom: 20rpx; align-items: center; gap: 8rpx; color: var(--color-accent); font-size: 25rpx; font-weight: 650; }
.summary-heading--with-action { justify-content: space-between; }
.summary-heading__title { display: flex; min-width: 0; align-items: center; gap: 8rpx; }
.summary-heading__icon { width: 28rpx; height: 28rpx; flex: none; }
.summary-heading__action { display: flex; width: 52rpx; height: 44rpx; margin: -6rpx -6rpx -6rpx 0; padding: 10rpx 14rpx; align-items: center; justify-content: center; border: 0; border-radius: 12rpx; background: transparent; color: var(--color-accent); }
.summary-heading__action::after { border: 0; }
.memory-row { display: flex; width: 100%; min-height: 60rpx; margin: 0; padding: 10rpx 0; align-items: center; gap: 14rpx; border: 0; border-top: var(--app-border-width) solid var(--color-border-subtle); background: transparent; text-align: left; }
.memory-row__date { flex: none; color: var(--color-accent); font-size: 20rpx; font-variant-numeric: tabular-nums; }
.memory-row__name { min-width: 0; overflow: hidden; color: var(--color-text); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.expense-group + .expense-group { margin-top: 16rpx; padding-top: 16rpx; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.expense-currency { display: block; margin-bottom: 10rpx; color: var(--color-accent); font-size: 20rpx; font-weight: 650; }
.expense-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.expense-metric { display: flex; min-width: 0; align-items: center; flex-direction: column; gap: 7rpx; text-align: center; }
.expense-metric__label { color: var(--color-muted); font-size: 20rpx; }
.expense-metric__value { max-width: 100%; overflow: hidden; color: var(--color-accent); font-size: 28rpx; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.artist-chips { align-items: flex-start; }

</style>
