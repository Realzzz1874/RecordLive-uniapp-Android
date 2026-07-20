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
import { performanceMediaPath } from '@/features/performances/browser'

const props = defineProps<{
  performances: Performance[]
}>()

const emit = defineEmits<{
  add: [startedAtMs: number]
  open: [id: string]
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
const artistRanking = computed(() => monthSummary.value.artistRanking.slice(0, 12))
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

function cellPoster(cell: ImprintCalendarCell): string {
  const performance = cell.performances.find((item) => performanceMediaPath(item, 'poster'))
  return performance ? performanceMediaPath(performance, 'poster') : ''
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
            <text class="month-count">✗ {{ monthPerformances.length }} 场</text>
          </view>
          <view class="month-toolbar__actions">
            <button class="month-action month-action--today" aria-label="回到本月" @tap="resetToCurrentMonth">今</button>
            <button class="month-action" aria-label="上个月" @tap="changeMonth(-1)"><AppIcon name="arrow-left" /></button>
            <button class="month-action month-action--next" aria-label="下个月" @tap="changeMonth(1)"><AppIcon name="arrow-left" /></button>
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
            aria-label="42 格月历"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @touchcancel="handleTouchEnd"
          >
            <button
              v-for="cell in calendarCells"
              :key="localDateKey(cell.dateMs)"
              class="calendar-cell"
              :class="{
                'calendar-cell--blank': !cell.inCurrentMonth,
                'calendar-cell--today': cell.isToday,
                'calendar-cell--selected': cell.isSelected,
                'calendar-cell--event': cell.count > 0,
              }"
              :disabled="!cell.inCurrentMonth"
              :aria-label="cell.inCurrentMonth ? cellLabel(cell) : undefined"
              @tap="handleDay(cell)"
            >
              <template v-if="cell.inCurrentMonth">
                <image v-if="cellPoster(cell)" class="calendar-cell__image" :src="cellPoster(cell)" mode="aspectFill" />
                <view v-else-if="cell.count" class="calendar-cell__fallback">
                  <text>{{ cell.performances[0]?.name }}</text>
                </view>
                <text v-else class="calendar-cell__empty-day">{{ cell.isToday ? '今' : cell.day }}</text>
                <text v-if="cell.count" class="calendar-cell__day-overlay">{{ cell.isToday ? '今' : cell.day }}</text>
                <text v-if="cell.count" class="calendar-cell__time">{{ formatTime(cell.performances[0]?.startedAtMs ?? cell.dateMs) }}</text>
                <text v-if="cell.count > 1" class="calendar-cell__badge">{{ cell.count }}</text>
              </template>
            </button>
          </view>
        </view>

        <text v-if="!monthPerformances.length" class="month-empty-tip">本月暂无演出，点击日期即可添加</text>
      </section>

      <section v-if="todayMemories.length" class="month-summary" aria-label="那年今日">
        <view class="summary-heading"><text>✦</text><text>那年今日</text></view>
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

      <section v-if="monthSummary.expenses.length" class="month-summary" aria-label="月度花费">
        <view class="summary-heading"><text>¥</text><text>花费</text></view>
        <view v-for="expense in monthSummary.expenses" :key="expense.currency" class="expense-row">
          <view><text class="expense-label">{{ expense.currency }}</text><text class="expense-value">{{ formatAggregatedAmount(expense.totalCost) }}</text></view>
          <text class="expense-detail">实付 {{ formatAggregatedAmount(expense.paidPrice) }} · 其他 {{ formatAggregatedAmount(expense.otherCost) }}</text>
        </view>
      </section>

      <section v-if="artistRanking.length" class="month-summary" aria-label="月度阵容">
        <view class="summary-heading"><text>♫</text><text>阵容</text></view>
        <view class="artist-chips">
          <text v-for="artist in artistRanking" :key="artist.name" class="artist-chip">{{ artist.name }} ✗{{ artist.count }}</text>
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
.month-count { flex: none; color: var(--color-accent); font-size: 21rpx; }
.month-toolbar__actions { flex: none; gap: 2rpx; }
.month-action { display: flex; width: 54rpx; height: 54rpx; margin: 0; padding: 14rpx; align-items: center; justify-content: center; border: 0; border-radius: 13rpx; background: transparent; color: var(--color-accent); }
.month-action::after, .calendar-cell::after, .memory-row::after { border: 0; }
.month-action--today { padding: 0; font-size: 23rpx; font-weight: 720; line-height: 54rpx; }
.month-action--next { transform: rotate(180deg); }
.weekday-grid, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekday-grid { margin: 24rpx 0 12rpx; }
.weekday { color: var(--color-accent); font-size: 21rpx; font-weight: 680; text-align: center; }
.calendar-viewport { overflow: hidden; }
.calendar-grid { gap: 6rpx; touch-action: pan-y; }
.calendar-grid--settling { transition: transform 360ms cubic-bezier(.22,.8,.3,1); }
.calendar-cell { box-sizing: border-box; position: relative; display: flex; min-width: 0; height: auto; aspect-ratio: 3 / 4; margin: 0; padding: 0; align-items: center; justify-content: center; overflow: hidden; border: var(--app-border-width) solid transparent; border-radius: 9rpx; background: var(--color-accent-soft); color: var(--color-on-accent); }
.calendar-cell--blank { background: transparent; opacity: 0; }
.calendar-cell--today { background: var(--color-accent); }
.calendar-cell--selected { border-color: var(--color-accent-border); box-shadow: inset 0 0 0 2rpx var(--color-background); }
.calendar-cell--event { background: var(--color-accent); }
.calendar-cell__image, .calendar-cell__fallback { width: 100%; height: 100%; }
.calendar-cell__image { position: absolute; inset: 0; object-position: center; }
.calendar-cell__fallback { display: flex; padding: 8rpx 5rpx 26rpx; align-items: center; justify-content: center; background: var(--color-accent); }
.calendar-cell__fallback text { display: -webkit-box; overflow: hidden; color: var(--color-on-accent); font-size: 18rpx; line-height: 1.2; text-align: center; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.calendar-cell__empty-day { color: var(--color-accent); font-size: 24rpx; font-weight: 650; }
.calendar-cell--today .calendar-cell__empty-day { color: var(--color-on-accent); }
.calendar-cell__day-overlay { position: absolute; top: 5rpx; left: 6rpx; color: #fff; font-size: 18rpx; font-weight: 720; text-shadow: 0 1rpx 4rpx rgba(0,0,0,.6); }
.calendar-cell__time { position: absolute; right: 0; bottom: 0; left: 0; padding: 4rpx 1rpx; background: rgba(255,255,255,.84); color: var(--color-accent); font-size: 15rpx; font-weight: 650; line-height: 18rpx; text-align: center; }
.calendar-cell__badge { position: absolute; top: 4rpx; right: 4rpx; display: flex; min-width: 24rpx; height: 24rpx; padding: 0 4rpx; align-items: center; justify-content: center; border-radius: 6rpx; background: rgba(255,255,255,.88); color: #b5473e; font-size: 15rpx; font-weight: 760; line-height: 24rpx; }
.month-empty-tip { display: block; padding: 26rpx 0 4rpx; color: var(--color-muted); font-size: 22rpx; text-align: center; }
.month-summary { padding: 22rpx; border-radius: 20rpx; background: var(--color-surface); box-shadow: 0 8rpx 26rpx var(--color-tab-shadow); }
.summary-heading { display: flex; margin-bottom: 16rpx; align-items: center; gap: 10rpx; color: var(--color-accent); font-size: 25rpx; font-weight: 700; }
.memory-row { display: flex; width: 100%; min-height: 60rpx; margin: 0; padding: 10rpx 0; align-items: center; gap: 14rpx; border: 0; border-top: var(--app-border-width) solid var(--color-border-subtle); background: transparent; text-align: left; }
.memory-row__date { flex: none; color: var(--color-accent); font-size: 20rpx; font-variant-numeric: tabular-nums; }
.memory-row__name { min-width: 0; overflow: hidden; color: var(--color-text); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.expense-row { display: flex; padding: 15rpx 0; align-items: center; justify-content: space-between; gap: 20rpx; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.expense-row > view { display: flex; align-items: baseline; gap: 10rpx; }
.expense-label { color: var(--color-accent); font-size: 20rpx; font-weight: 720; }
.expense-value { color: var(--color-text); font-size: 29rpx; font-weight: 750; font-variant-numeric: tabular-nums; }
.expense-detail { color: var(--color-muted); font-size: 18rpx; }
.artist-chips { display: flex; flex-wrap: wrap; gap: 9rpx; }
.artist-chip { padding: 8rpx 13rpx; border-radius: 15rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 20rpx; font-weight: 620; }

</style>
