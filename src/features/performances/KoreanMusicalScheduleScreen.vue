<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  formatKoreanScheduleDate,
  formatKoreanScheduleDateTime,
  KOREAN_MUSICAL_SCHEDULE_FIELDS,
  KoreanMusicalScheduleService,
  type KoreanMusicalSchedule,
  type KoreanMusicalScheduleField,
} from '@/features/performances/korean-musical-schedule'

type LoadStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error'

interface PickerChangeEvent {
  detail: { value: string | number }
}

interface FieldOption {
  key: KoreanMusicalScheduleField
  label: string
  value: string
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [payload: {
    schedule: KoreanMusicalSchedule
    fields: KoreanMusicalScheduleField[]
  }]
}>()

const service = new KoreanMusicalScheduleService()
const today = formatKoreanScheduleDate(Date.now())
const date = ref(today)
const schedules = ref<KoreanMusicalSchedule[]>([])
const status = ref<LoadStatus>('idle')
const errorMessage = ref('')
const selectedSchedule = ref<KoreanMusicalSchedule | null>(null)
const selectedFields = ref<KoreanMusicalScheduleField[]>([])
let requestVersion = 0

const groupedSchedules = computed(() => {
  const groups = new Map<string, KoreanMusicalSchedule[]>()
  schedules.value.forEach((schedule) => {
    groups.set(schedule.time, [...(groups.get(schedule.time) ?? []), schedule])
  })
  return [...groups.entries()].map(([time, shows]) => ({ time, shows }))
})

const resultDescription = computed(() => {
  if (status.value === 'loading') return '正在查询排期…'
  if (status.value === 'empty') return '未能搜索到排期内容'
  if (status.value === 'error') return errorMessage.value || '请求出现错误'
  return ''
})

const fieldOptions = computed<FieldOption[]>(() => {
  const schedule = selectedSchedule.value
  if (!schedule) return []
  return [
    { key: 'name', label: '名称', value: schedule.name },
    { key: 'date', label: '时间', value: formatKoreanScheduleDateTime(schedule.startedAtMs) },
    { key: 'play', label: '剧目', value: schedule.play },
    ...(schedule.artists.length
      ? [{ key: 'artist' as const, label: '阵容', value: schedule.artists.join('、') }]
      : []),
  ]
})

watch(() => props.visible, async (visible) => {
  if (!visible) {
    requestVersion += 1
    return
  }
  resetScreen()
  await loadSchedules()
})

function resetScreen(): void {
  date.value = today
  schedules.value = []
  status.value = 'idle'
  errorMessage.value = ''
  selectedSchedule.value = null
  selectedFields.value = []
}

async function updateDate(event: PickerChangeEvent): Promise<void> {
  date.value = String(event.detail.value)
  await loadSchedules()
}

async function loadSchedules(): Promise<void> {
  const version = ++requestVersion
  status.value = 'loading'
  schedules.value = []
  errorMessage.value = ''
  try {
    const result = await service.searchByDate(date.value)
    if (version !== requestVersion) return
    schedules.value = result
    status.value = result.length ? 'ready' : 'empty'
  } catch (error) {
    if (version !== requestVersion) return
    status.value = 'error'
    errorMessage.value = error instanceof Error && error.message
      ? error.message
      : '请求出现错误'
  }
}

function chooseSchedule(schedule: KoreanMusicalSchedule): void {
  selectedSchedule.value = schedule
  selectedFields.value = fieldOptions.value.map(({ key }) => key)
}

function toggleField(field: KoreanMusicalScheduleField): void {
  selectedFields.value = selectedFields.value.includes(field)
    ? selectedFields.value.filter((item) => item !== field)
    : KOREAN_MUSICAL_SCHEDULE_FIELDS.filter(
        (item) => item === field || selectedFields.value.includes(item),
      )
}

function closeSelection(): void {
  selectedSchedule.value = null
  selectedFields.value = []
}

function confirmSelection(): void {
  if (!selectedSchedule.value) return
  emit('apply', {
    schedule: selectedSchedule.value,
    fields: [...selectedFields.value],
  })
  closeSelection()
}
</script>

<template>
  <view v-if="visible" class="schedule-screen">
    <AppHeader
      title="韩国音乐剧排期"
      show-back
      back-icon="close"
      back-label="关闭韩国音乐剧排期"
      @back="$emit('close')"
    />

    <scroll-view class="schedule-content" scroll-y>
      <section class="query-section">
        <text class="query-section__title">数据源自网络，请仔细核对</text>
        <picker mode="date" :value="date" :start="today" @change="updateDate">
          <view class="date-row" aria-label="选择韩国音乐剧排期日期">
            <text>选择时间</text>
            <view class="date-row__value">
              <text>{{ date }}</text>
              <view class="date-row__chevron"><AppIcon name="chevron" /></view>
            </view>
          </view>
        </picker>
        <text class="source-note">数据源：myukit.com</text>
      </section>

      <view v-if="resultDescription" class="state-card" :class="{ 'state-card--error': status === 'error' }">
        {{ resultDescription }}
      </view>

      <view v-if="status === 'ready'" class="result-section">
        <section v-for="group in groupedSchedules" :key="group.time" class="time-group">
          <text class="time-group__title">{{ group.time }}</text>
          <button
            v-for="schedule in group.shows"
            :key="schedule.id"
            class="schedule-row"
            :aria-label="`选择韩国排期${schedule.name}${formatKoreanScheduleDateTime(schedule.startedAtMs)}`"
            hover-class="schedule-row--pressed"
            @tap="chooseSchedule(schedule)"
          >
            <text class="schedule-row__name">{{ schedule.name }}</text>
            <text v-if="schedule.artists.length" class="schedule-row__artists">{{ schedule.artists.join('、') }}</text>
            <view class="schedule-row__chevron"><AppIcon name="chevron" /></view>
          </button>
        </section>
      </view>
    </scroll-view>

    <view v-if="selectedSchedule" class="field-layer">
      <button class="field-scrim" aria-label="取消选择韩国排期字段" @tap="closeSelection" />
      <view class="field-dialog" aria-label="选择韩国排期需要填入的字段">
        <text class="field-dialog__title">勾选所需字段</text>
        <text class="field-dialog__source">{{ selectedSchedule.name }}</text>
        <view class="field-list">
          <button
            v-for="field in fieldOptions"
            :key="field.key"
            class="field-row"
            :aria-label="`${selectedFields.includes(field.key) ? '取消填入' : '填入'}${field.label}`"
            @tap="toggleField(field.key)"
          >
            <view class="field-check" :class="{ 'field-check--selected': selectedFields.includes(field.key) }">
              <AppIcon v-if="selectedFields.includes(field.key)" name="check" />
            </view>
            <text class="field-row__label">{{ field.label }}</text>
            <text class="field-row__value">{{ field.value }}</text>
          </button>
        </view>
        <view class="field-actions">
          <button @tap="closeSelection">取消</button>
          <button aria-label="确认填入所选韩国排期字段" @tap="confirmSelection">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.schedule-screen { position: fixed; z-index: 85; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.schedule-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 0 28rpx calc(60rpx + env(safe-area-inset-bottom)); }
.query-section { padding-top: 24rpx; }
.query-section__title { display: block; margin: 0 4rpx 15rpx; color: var(--color-accent); font-size: 23rpx; font-weight: 650; }
.date-row { display: flex; height: 84rpx; padding: 0 20rpx; align-items: center; justify-content: space-between; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); color: var(--color-text); font-size: 25rpx; }
.date-row__value { display: flex; align-items: center; gap: 10rpx; color: var(--color-accent); font-size: 24rpx; font-variant-numeric: tabular-nums; }
.date-row__chevron { width: 25rpx; height: 25rpx; color: var(--color-muted); }
.source-note { display: block; margin: 12rpx 6rpx 20rpx; color: var(--color-muted); font-size: 20rpx; }
.state-card { margin: 26rpx 0; padding: 50rpx 24rpx; border-radius: 18rpx; background: var(--color-surface); color: var(--color-muted); font-size: 23rpx; text-align: center; }
.state-card--error { color: var(--color-danger); }
.result-section { padding-bottom: 30rpx; }
.time-group { overflow: hidden; margin-top: 18rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.time-group__title { display: block; padding: 15rpx 18rpx; border-bottom: var(--app-border-width) solid var(--color-border-subtle); color: var(--color-accent); font-size: 23rpx; font-weight: 700; }
.schedule-row { position: relative; display: flex; width: 100%; min-height: 96rpx; margin: 0; padding: 16rpx 48rpx 16rpx 18rpx; flex-direction: column; justify-content: center; gap: 7rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.schedule-row:last-child { border-bottom: 0; }
.schedule-row::after, .field-scrim::after, .field-row::after, .field-actions button::after { border: 0; }
.schedule-row--pressed { background: var(--color-row-pressed); }
.schedule-row__name { overflow: hidden; font-size: 25rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.schedule-row__artists { display: -webkit-box; overflow: hidden; color: var(--color-muted); font-size: 21rpx; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.schedule-row__chevron { position: absolute; top: 50%; right: 12rpx; width: 25rpx; height: 25rpx; color: var(--color-muted); transform: translateY(-50%); }
.field-layer { position: absolute; z-index: 5; inset: 0; display: flex; padding: 32rpx; align-items: center; justify-content: center; }
.field-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15, 10, 8, .52); }
.field-dialog { position: relative; z-index: 1; box-sizing: border-box; width: 100%; padding: 30rpx; border-radius: 24rpx; background: var(--color-surface); box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, .22); }
.field-dialog__title, .field-dialog__source { display: block; text-align: center; }
.field-dialog__title { font-size: 30rpx; font-weight: 700; }
.field-dialog__source { margin: 8rpx 0 20rpx; overflow: hidden; color: var(--color-muted); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.field-list { border-top: var(--app-border-width) solid var(--color-border-subtle); }
.field-row { display: flex; width: 100%; min-height: 76rpx; margin: 0; padding: 9rpx 4rpx; align-items: center; gap: 12rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.field-check { box-sizing: border-box; width: 34rpx; height: 34rpx; padding: 4rpx; flex: none; border: var(--app-border-width) solid var(--color-border); border-radius: 7rpx; color: transparent; }
.field-check--selected { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-on-accent); }
.field-row__label { width: 92rpx; flex: none; font-size: 24rpx; }
.field-row__value { min-width: 0; overflow: hidden; flex: 1; color: var(--color-muted); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.field-actions { display: grid; margin-top: 22rpx; grid-template-columns: repeat(2, 1fr); gap: 14rpx; }
.field-actions button { height: 70rpx; margin: 0; border: 0; border-radius: 14rpx; background: var(--color-row-pressed); color: var(--color-muted); font-size: 25rpx; line-height: 70rpx; }
.field-actions button:last-child { background: var(--color-accent); color: var(--color-on-accent); }
</style>
