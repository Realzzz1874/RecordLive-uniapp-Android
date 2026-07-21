<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  CHINESE_MUSICAL_SCHEDULE_FIELDS,
  ChineseMusicalScheduleService,
  formatScheduleDate,
  formatScheduleDateTime,
  type ChineseMusicalArtist,
  type ChineseMusicalSchedule,
  type ChineseMusicalScheduleField,
} from '@/features/performances/chinese-musical-schedule'
import {
  groupedLocationCities,
  type CityRegion,
} from '@/features/performances/location'
import { useQuickAddPreferencesStore } from '@/stores/quick-add-preferences'

type SearchMode = 'default' | 'play' | 'artist'
type LoadStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error'

interface PickerChangeEvent {
  detail: { value: string | number }
}

interface FieldOption {
  key: ChineseMusicalScheduleField
  label: string
  value: string
}

const props = defineProps<{
  visible: boolean
  initialStartedAtMs: number
}>()

const emit = defineEmits<{
  close: []
  apply: [payload: {
    schedule: ChineseMusicalSchedule
    fields: ChineseMusicalScheduleField[]
  }]
}>()

const service = new ChineseMusicalScheduleService()
const quickAddPreferencesStore = useQuickAddPreferencesStore()
const { chineseMusicalCity } = storeToRefs(quickAddPreferencesStore)

const mode = ref<SearchMode>('default')
const date = ref(formatScheduleDate(Date.now()))
const city = ref('上海')
const playName = ref('')
const startDate = ref(formatScheduleDate(Date.now()))
const endDate = ref(formatScheduleDate(Date.now()))
const artistName = ref('')
const artists = ref<ChineseMusicalArtist[]>([])
const selectedArtist = ref<ChineseMusicalArtist | null>(null)
const schedules = ref<ChineseMusicalSchedule[]>([])
const status = ref<LoadStatus>('idle')
const artistStatus = ref<LoadStatus>('idle')
const errorMessage = ref('')
const selectedSchedule = ref<ChineseMusicalSchedule | null>(null)
const selectedFields = ref<ChineseMusicalScheduleField[]>([])
const cityPickerVisible = ref(false)
const cityRegion = ref<CityRegion>('default')
const citySearch = ref('')
let requestVersion = 0

const cityGroups = computed(() => groupedLocationCities(cityRegion.value, citySearch.value))
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
    { key: 'date', label: '时间', value: formatScheduleDateTime(schedule.startedAtMs) },
    { key: 'city', label: '城市', value: schedule.city },
    { key: 'venue', label: '场地', value: schedule.venue },
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
  await quickAddPreferencesStore.initialize()
  resetScreen()
  city.value = chineseMusicalCity.value
  await loadDefaultSchedules()
})

function resetScreen(): void {
  const initialDate = new Date(props.initialStartedAtMs)
  const initialDateText = formatScheduleDate(initialDate)
  mode.value = 'default'
  date.value = initialDateText
  startDate.value = initialDateText
  endDate.value = initialDateText
  playName.value = ''
  artistName.value = ''
  artists.value = []
  selectedArtist.value = null
  schedules.value = []
  status.value = 'idle'
  artistStatus.value = 'idle'
  errorMessage.value = ''
  selectedSchedule.value = null
  selectedFields.value = []
  cityPickerVisible.value = false
  citySearch.value = ''
}

async function setMode(value: SearchMode): Promise<void> {
  mode.value = value
  schedules.value = []
  status.value = 'idle'
  errorMessage.value = ''
  if (value === 'default') await loadDefaultSchedules()
}

async function loadDefaultSchedules(): Promise<void> {
  await runScheduleRequest(() => service.searchByDay(date.value, city.value))
}

async function queryPlaySchedules(): Promise<void> {
  const play = playName.value.trim()
  if (!play) return
  if (startDate.value > endDate.value) {
    uni.showToast({ title: '结束时间不能早于开始时间', icon: 'none' })
    return
  }
  await runScheduleRequest(() => service.searchByPlay(play, startDate.value, endDate.value))
}

async function searchArtists(): Promise<void> {
  const name = artistName.value.trim()
  if (!name) return
  const version = ++requestVersion
  artistStatus.value = 'loading'
  artists.value = []
  selectedArtist.value = null
  schedules.value = []
  status.value = 'idle'
  errorMessage.value = ''
  try {
    const result = await service.searchArtists(name)
    if (version !== requestVersion) return
    artists.value = result
    artistStatus.value = result.length ? 'ready' : 'empty'
  } catch (error) {
    if (version !== requestVersion) return
    artistStatus.value = 'error'
    errorMessage.value = errorText(error)
  }
}

async function chooseArtist(artist: ChineseMusicalArtist): Promise<void> {
  selectedArtist.value = artist
  await runScheduleRequest(() => service.searchByArtist(artist))
}

async function runScheduleRequest(loader: () => Promise<ChineseMusicalSchedule[]>): Promise<void> {
  const version = ++requestVersion
  status.value = 'loading'
  schedules.value = []
  errorMessage.value = ''
  try {
    const result = await loader()
    if (version !== requestVersion) return
    schedules.value = result
    status.value = result.length ? 'ready' : 'empty'
  } catch (error) {
    if (version !== requestVersion) return
    status.value = 'error'
    errorMessage.value = errorText(error)
  }
}

async function updateDefaultDate(event: PickerChangeEvent): Promise<void> {
  date.value = String(event.detail.value)
  await loadDefaultSchedules()
}

function updateStartDate(event: PickerChangeEvent): void {
  startDate.value = String(event.detail.value)
}

function updateEndDate(event: PickerChangeEvent): void {
  endDate.value = String(event.detail.value)
}

async function chooseCity(value: string): Promise<void> {
  city.value = value.trim()
  quickAddPreferencesStore.setChineseMusicalCity(city.value)
  cityPickerVisible.value = false
  citySearch.value = ''
  await loadDefaultSchedules()
}

function chooseSchedule(schedule: ChineseMusicalSchedule): void {
  selectedSchedule.value = schedule
  selectedFields.value = fieldOptions.value.map(({ key }) => key)
}

function toggleField(field: ChineseMusicalScheduleField): void {
  selectedFields.value = selectedFields.value.includes(field)
    ? selectedFields.value.filter((item) => item !== field)
    : CHINESE_MUSICAL_SCHEDULE_FIELDS.filter(
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

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '请求出现错误'
}

function weekday(timestamp: number): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(timestamp).getDay()]
}
</script>

<template>
  <view v-if="visible" class="schedule-screen">
    <AppHeader
      title="中文音乐剧排期"
      show-back
      back-icon="close"
      back-label="关闭中文音乐剧排期"
      @back="$emit('close')"
    />

    <view class="mode-tabs" aria-label="排期查询方式">
      <button :class="{ active: mode === 'default' }" aria-label="默认查询" @tap="setMode('default')">默认</button>
      <button :class="{ active: mode === 'play' }" aria-label="按剧目查询" @tap="setMode('play')">选剧</button>
      <button :class="{ active: mode === 'artist' }" aria-label="按演员查询" @tap="setMode('artist')">选演员</button>
    </view>

    <scroll-view class="schedule-content" scroll-y>
      <view v-if="mode === 'default'" class="query-section">
        <text class="query-section__title">可选城市与日期</text>
        <view class="query-card query-card--split">
          <button class="query-selector" aria-label="选择排期城市" @tap="cityPickerVisible = true">
            <view class="query-selector__icon"><AppIcon name="location" /></view>
            <text>{{ city }}</text>
            <view class="query-selector__chevron"><AppIcon name="chevron" /></view>
          </button>
          <picker mode="date" :value="date" @change="updateDefaultDate">
            <view class="date-selector" aria-label="选择排期日期">{{ date }}</view>
          </picker>
        </view>
        <text class="source-note">数据源：y.saoju.net</text>
      </view>

      <view v-else-if="mode === 'play'" class="query-section">
        <text class="query-section__title">查询该剧目在指定时间范围内的排期</text>
        <view class="query-card">
          <label class="input-row">
            <text>剧目</text>
            <input v-model="playName" maxlength="100" aria-label="完整剧目名称" placeholder="请输入完整剧目名称">
          </label>
          <picker mode="date" :value="startDate" @change="updateStartDate">
            <view class="input-row"><text>开始时间</text><text>{{ startDate }}</text></view>
          </picker>
          <picker mode="date" :value="endDate" @change="updateEndDate">
            <view class="input-row"><text>结束时间</text><text>{{ endDate }}</text></view>
          </picker>
          <button class="query-button" :disabled="!playName.trim()" aria-label="查询剧目排期" @tap="queryPlaySchedules">查询</button>
        </view>
        <text class="source-note">数据源：y.saoju.net</text>
      </view>

      <view v-else class="query-section">
        <text class="query-section__title">查询该演员的排期</text>
        <view class="search-row">
          <input v-model="artistName" maxlength="100" aria-label="演员完整姓名" placeholder="请输入演员完整姓名" confirm-type="search" @confirm="searchArtists">
          <button :disabled="!artistName.trim()" aria-label="搜索演员" @tap="searchArtists">搜索</button>
        </view>
        <text class="source-note">数据源：y.saoju.net</text>

        <view v-if="artistStatus === 'loading'" class="state-card">正在搜索演员…</view>
        <view v-else-if="artistStatus === 'empty'" class="state-card">未能搜索到相关演员</view>
        <view v-else-if="artistStatus === 'error'" class="state-card state-card--error">{{ errorMessage }}</view>
        <view v-else-if="artists.length" class="artist-results">
          <text>✓ 搜索到 {{ artists.length }} 名演员，请选择：</text>
          <button
            v-for="artist in artists"
            :key="artist.path"
            :class="{ selected: selectedArtist?.path === artist.path }"
            :aria-label="`选择演员${artist.name}`"
            @tap="chooseArtist(artist)"
          >
            <view class="artist-radio" />
            <text>{{ artist.name }}</text>
          </button>
        </view>
      </view>

      <view v-if="resultDescription" class="state-card" :class="{ 'state-card--error': status === 'error' }">
        {{ resultDescription }}
      </view>

      <view v-if="status === 'ready'" class="result-section">
        <text v-if="mode !== 'default'" class="result-count">查询到 {{ schedules.length }} 场</text>
        <button
          v-for="schedule in schedules"
          :key="schedule.id"
          class="schedule-row"
          :aria-label="`选择排期${schedule.name}${formatScheduleDateTime(schedule.startedAtMs)}`"
          hover-class="schedule-row--pressed"
          @tap="chooseSchedule(schedule)"
        >
          <view class="schedule-row__heading">
            <text class="schedule-row__name">{{ schedule.name }}</text>
            <text>{{ mode === 'default' ? formatScheduleDateTime(schedule.startedAtMs).slice(11) : `${formatScheduleDate(schedule.startedAtMs)} ${weekday(schedule.startedAtMs)}` }}</text>
          </view>
          <text class="schedule-row__place">{{ schedule.city }} · {{ schedule.venue }}</text>
          <text v-if="schedule.artists.length" class="schedule-row__artists">{{ schedule.artists.join('、') }}</text>
          <view class="schedule-row__chevron"><AppIcon name="chevron" /></view>
        </button>
      </view>
    </scroll-view>

    <view v-if="selectedSchedule" class="field-layer">
      <button class="field-scrim" aria-label="取消选择排期字段" @tap="closeSelection" />
      <view class="field-dialog" aria-label="选择排期需要填入的字段">
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
          <button aria-label="确认填入所选排期字段" @tap="confirmSelection">确定</button>
        </view>
      </view>
    </view>

    <view v-if="cityPickerVisible" class="city-layer">
      <AppHeader title="选择城市" show-back @back="cityPickerVisible = false" />
      <view class="city-tabs">
        <button :class="{ active: cityRegion === 'default' }" @tap="cityRegion = 'default'">默认地区</button>
        <button :class="{ active: cityRegion === 'other' }" @tap="cityRegion = 'other'">其它地区</button>
      </view>
      <view class="city-search">
        <AppIcon name="search" />
        <input v-model="citySearch" aria-label="搜索排期城市" placeholder="搜索城市或拼音">
      </view>
      <scroll-view class="city-list" scroll-y>
        <view v-for="group in cityGroups" :key="group.initial">
          <text class="city-group-title">{{ group.initial }}</text>
          <button v-for="item in group.cities" :key="item.nameEn" :aria-label="`选择排期城市${item.name}`" @tap="chooseCity(item.name)">
            <text>{{ item.name }}</text><AppIcon name="chevron" />
          </button>
        </view>
        <text v-if="!cityGroups.length" class="city-empty">没有匹配的城市</text>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.schedule-screen { position: fixed; z-index: 84; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.mode-tabs { display: grid; height: 64rpx; margin: 8rpx 28rpx 16rpx; padding: 4rpx; grid-template-columns: 1fr 1fr 1.6fr; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); }
.mode-tabs button { height: 54rpx; margin: 0; padding: 0 12rpx; border: 0; border-radius: 12rpx; background: transparent; color: var(--color-muted); font-size: 23rpx; font-weight: 620; line-height: 54rpx; white-space: nowrap; }
.mode-tabs button.active { background: var(--color-accent); color: var(--color-on-accent); box-shadow: 0 4rpx 10rpx var(--color-tab-shadow); }
.city-tabs button { height: 58rpx; margin: 0; padding: 0; border: 0; border-radius: 11rpx; background: transparent; color: var(--color-muted); font-size: 23rpx; line-height: 58rpx; }
.mode-tabs button::after, .query-selector::after, .query-button::after, .search-row button::after, .artist-results button::after, .schedule-row::after, .field-scrim::after, .field-row::after, .field-actions button::after, .city-tabs button::after, .city-list button::after { border: 0; }
.city-tabs button.active { background: var(--color-surface); color: var(--color-text); font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, .08); }
.schedule-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 92rpx); padding: 0 28rpx calc(60rpx + env(safe-area-inset-bottom)); }
.query-section { padding-top: 10rpx; }
.query-section__title { display: block; margin: 0 4rpx 15rpx; color: var(--color-accent); font-size: 23rpx; font-weight: 650; }
.query-card { overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 20rpx; background: var(--color-surface); }
.query-card--split { display: grid; grid-template-columns: 1fr auto; }
.query-selector { display: flex; min-width: 0; height: 84rpx; margin: 0; padding: 0 18rpx; align-items: center; gap: 10rpx; border: 0; border-radius: 0; background: transparent; color: var(--color-text); font-size: 26rpx; }
.query-selector__icon, .query-selector__chevron { width: 28rpx; height: 28rpx; flex: none; color: var(--color-muted); }
.date-selector { min-width: 190rpx; height: 84rpx; padding: 0 20rpx; border-left: var(--app-border-width) solid var(--color-border-subtle); color: var(--color-accent); font-size: 24rpx; line-height: 84rpx; text-align: center; }
.source-note { display: block; margin: 12rpx 6rpx 20rpx; color: var(--color-muted); font-size: 20rpx; }
.input-row { display: flex; min-height: 82rpx; padding: 0 22rpx; align-items: center; justify-content: space-between; gap: 20rpx; border-bottom: var(--app-border-width) solid var(--color-border-subtle); font-size: 24rpx; }
.input-row input { min-width: 0; flex: 1; color: var(--color-text); font-size: 24rpx; text-align: right; }
.query-button { height: 74rpx; margin: 12rpx; border: 0; border-radius: 14rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 25rpx; font-weight: 650; line-height: 74rpx; }
.query-button[disabled], .search-row button[disabled] { opacity: .45; }
.search-row { display: flex; height: 78rpx; overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.search-row input { box-sizing: border-box; min-width: 0; height: 78rpx; padding: 0 20rpx; flex: 1; color: var(--color-text); font-size: 24rpx; line-height: 78rpx; }
.search-row button { width: 116rpx; height: 78rpx; margin: 0; border: 0; border-radius: 0; background: var(--color-accent-soft); color: var(--color-accent); font-size: 24rpx; line-height: 78rpx; }
.state-card { margin: 26rpx 0; padding: 50rpx 24rpx; border-radius: 18rpx; background: var(--color-surface); color: var(--color-muted); font-size: 23rpx; text-align: center; }
.state-card--error { color: var(--color-danger); }
.artist-results { margin-bottom: 24rpx; overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.artist-results > text { display: block; padding: 18rpx 20rpx; color: var(--color-muted); font-size: 21rpx; }
.artist-results button { display: flex; width: 100%; height: 72rpx; margin: 0; padding: 0 20rpx; align-items: center; gap: 14rpx; border: 0; border-top: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); font-size: 24rpx; text-align: left; }
.artist-results button.selected { color: var(--color-accent); font-weight: 650; }
.artist-radio { box-sizing: border-box; width: 28rpx; height: 28rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 50%; }
.artist-results button.selected .artist-radio { border: 8rpx solid var(--color-accent); }
.result-section { overflow: hidden; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.result-count { display: block; padding: 16rpx 8rpx 8rpx; color: var(--color-muted); font-size: 21rpx; }
.schedule-row { position: relative; display: flex; width: 100%; min-height: 112rpx; margin: 0; padding: 18rpx 48rpx 18rpx 10rpx; flex-direction: column; justify-content: center; gap: 6rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.schedule-row--pressed { background: var(--color-row-pressed); }
.schedule-row__heading { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12rpx; color: var(--color-accent); font-size: 23rpx; }
.schedule-row__name { min-width: 0; overflow: hidden; font-size: 26rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.schedule-row__place, .schedule-row__artists { overflow: hidden; color: var(--color-muted); font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.schedule-row__chevron { position: absolute; top: 43rpx; right: 8rpx; width: 26rpx; height: 26rpx; color: var(--color-muted); }
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
.city-layer { position: absolute; z-index: 6; inset: 0; background: var(--color-background); }
.city-tabs { display: grid; margin: 16rpx 28rpx; padding: 5rpx; grid-template-columns: repeat(2, 1fr); border-radius: 15rpx; background: var(--color-row-pressed); }
.city-search { display: flex; height: 74rpx; margin: 0 28rpx 15rpx; padding: 0 18rpx; align-items: center; gap: 12rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); }
.city-search > :first-child { width: 28rpx; height: 28rpx; color: var(--color-muted); }
.city-search input { min-width: 0; flex: 1; font-size: 24rpx; }
.city-list { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 180rpx); padding: 0 28rpx calc(50rpx + env(safe-area-inset-bottom)); }
.city-group-title { display: block; padding: 17rpx 12rpx 8rpx; color: var(--color-accent); font-size: 21rpx; font-weight: 700; }
.city-list button { display: flex; width: 100%; height: 72rpx; margin: 0; padding: 0 12rpx; align-items: center; justify-content: space-between; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); font-size: 25rpx; text-align: left; }
.city-list button > :last-child { width: 25rpx; height: 25rpx; color: var(--color-muted); }
.city-empty { display: block; padding: 80rpx 20rpx; color: var(--color-muted); text-align: center; }
</style>
