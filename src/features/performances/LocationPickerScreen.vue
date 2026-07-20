<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  formatSelectedLocation,
  frequentLocationCities,
  groupedLocationCities,
  locationVenues,
  type CityRegion,
} from '@/features/performances/location'

const props = defineProps<{
  visible: boolean
  city: string
  venue: string
  performances: readonly Performance[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [location: { city: string; venue: string }]
}>()

const step = ref<'form' | 'city' | 'venue'>('form')
const selectedCity = ref('')
const selectedVenue = ref('')
const cityRegion = ref<CityRegion>('default')
const citySearch = ref('')
const venueSearch = ref('')
const manualCityVisible = ref(false)
const manualVenueVisible = ref(false)
const manualCity = ref('')
const manualVenue = ref('')

const title = computed(() => {
  if (step.value === 'city') return '选择城市'
  if (step.value === 'venue') return '选择场地'
  return '选择城市与场地'
})
const cityGroups = computed(() => groupedLocationCities(cityRegion.value, citySearch.value))
const frequentCities = computed(() => frequentLocationCities(props.performances))
const venues = computed(() => locationVenues(selectedCity.value, props.performances, venueSearch.value))
const selectedLocation = computed(() => formatSelectedLocation(selectedCity.value, selectedVenue.value))
const canConfirm = computed(() => Boolean(selectedCity.value.trim() && selectedVenue.value.trim()))

watch(() => props.visible, (visible) => {
  if (!visible) return
  step.value = 'form'
  selectedCity.value = props.city.trim()
  selectedVenue.value = props.venue.trim()
  citySearch.value = ''
  venueSearch.value = ''
  manualCityVisible.value = false
  manualVenueVisible.value = false
  manualCity.value = ''
  manualVenue.value = ''
}, { immediate: true })

function handleBack(): void {
  if (step.value !== 'form') {
    step.value = 'form'
    return
  }
  emit('close')
}

function chooseCity(city: string): void {
  const normalized = city.trim()
  if (!normalized) return
  if (selectedCity.value !== normalized) selectedVenue.value = ''
  selectedCity.value = normalized
  citySearch.value = ''
  manualCityVisible.value = false
  manualCity.value = ''
  step.value = 'form'
}

function chooseVenue(venue: string): void {
  const normalized = venue.trim()
  if (!normalized) return
  selectedVenue.value = normalized
  venueSearch.value = ''
  manualVenueVisible.value = false
  manualVenue.value = ''
  step.value = 'form'
}

function openVenuePicker(): void {
  if (!selectedCity.value) {
    uni.showToast({ title: '请先选择城市', icon: 'none' })
    return
  }
  step.value = 'venue'
}

function confirm(): void {
  if (!canConfirm.value) return
  emit('confirm', { city: selectedCity.value.trim(), venue: selectedVenue.value.trim() })
}
</script>

<template>
  <view v-if="visible" class="location-picker-screen">
    <AppHeader :title="title" show-back @back="handleBack" />

    <scroll-view v-if="step === 'form'" class="location-picker-content" scroll-y>
<!--      <view class="location-intro">
        <view class="location-intro__icon"><AppIcon name="location" /></view>
        <view>
          <text class="location-intro__title">手动选择演出地点</text>
          <text class="location-intro__description">选择城市后，再从该城市的场地列表中选择；本流程不使用地图或定位。</text>
        </view>
      </view> -->

      <view class="location-form-card">
        <button class="location-row" aria-label="选择城市" @tap="step = 'city'">
          <view class="location-row__copy">
            <text class="location-row__label">城市 *</text>
            <text class="location-row__value" :class="{ 'location-row__value--placeholder': !selectedCity }">
              {{ selectedCity || '选择城市' }}
            </text>
          </view>
          <view class="location-row__chevron"><AppIcon name="chevron" /></view>
        </button>
        <button class="location-row" aria-label="选择场地" @tap="openVenuePicker">
          <view class="location-row__copy">
            <text class="location-row__label">场地 *</text>
            <text class="location-row__value" :class="{ 'location-row__value--placeholder': !selectedVenue }">
              {{ selectedVenue || (selectedCity ? '选择场地' : '请先选择城市') }}
            </text>
          </view>
          <view class="location-row__chevron"><AppIcon name="chevron" /></view>
        </button>
      </view>

      <view v-if="selectedLocation" class="location-preview">
        <text class="location-preview__label">已选择</text>
        <text class="location-preview__value">{{ selectedLocation }}</text>
      </view>

      <button
        class="location-confirm"
        :disabled="!canConfirm"
        aria-label="确认城市与场地"
        @tap="confirm"
      >确定</button>
    </scroll-view>

    <template v-else-if="step === 'city'">
      <view class="region-tabs" aria-label="城市地区">
        <button
          class="region-tab"
          :class="{ 'region-tab--active': cityRegion === 'default' }"
          aria-label="默认地区"
          @tap="cityRegion = 'default'"
        >默认地区</button>
        <button
          class="region-tab"
          :class="{ 'region-tab--active': cityRegion === 'other' }"
          aria-label="其它地区"
          @tap="cityRegion = 'other'"
        >其它地区</button>
      </view>
      <view class="location-search">
        <AppIcon name="search" />
        <input v-model="citySearch" aria-label="搜索城市" placeholder="搜索城市或拼音">
      </view>
      <scroll-view class="selection-list" scroll-y>
        <view class="manual-section">
          <button class="manual-toggle" aria-label="手动添加城市" @tap="manualCityVisible = !manualCityVisible">
            <AppIcon name="plus" />
            <text>手动添加城市</text>
          </button>
          <view v-if="manualCityVisible" class="manual-form">
            <input v-model="manualCity" aria-label="自定义城市" maxlength="50" placeholder="请输入城市名称">
            <button :disabled="!manualCity.trim()" aria-label="确认自定义城市" @tap="chooseCity(manualCity)">确定</button>
          </view>
        </view>

        <view v-if="frequentCities.length && !citySearch" class="selection-section">
          <text class="selection-section__title">常去城市</text>
          <button
            v-for="city in frequentCities"
            :key="`frequent-${city}`"
            class="selection-row"
            :aria-label="`选择城市${city}`"
            @tap="chooseCity(city)"
          >
            <text>{{ city }}</text><AppIcon name="chevron" />
          </button>
        </view>

        <view v-for="group in cityGroups" :key="group.initial" class="selection-section">
          <text class="selection-section__title">{{ group.initial }}</text>
          <button
            v-for="city in group.cities"
            :key="city.nameEn"
            class="selection-row"
            :aria-label="`选择城市${city.name}`"
            @tap="chooseCity(city.name)"
          >
            <text>{{ city.name }}</text><AppIcon name="chevron" />
          </button>
        </view>
        <view v-if="cityGroups.length === 0" class="selection-empty">没有匹配的城市，可以使用“手动添加城市”。</view>
      </scroll-view>
    </template>

    <template v-else>
      <view class="venue-city-banner">
        <text>当前城市</text>
        <text>{{ selectedCity }}</text>
      </view>
      <view class="location-search">
        <AppIcon name="search" />
        <input v-model="venueSearch" aria-label="搜索场地" placeholder="搜索场地名称">
      </view>
      <scroll-view class="selection-list selection-list--venue" scroll-y>
        <view class="manual-section">
          <button class="manual-toggle" aria-label="手动添加场地" @tap="manualVenueVisible = !manualVenueVisible">
            <AppIcon name="plus" />
            <text>手动添加场地</text>
          </button>
          <view v-if="manualVenueVisible" class="manual-form">
            <input v-model="manualVenue" aria-label="自定义场地" maxlength="80" placeholder="请输入场地名称">
            <button :disabled="!manualVenue.trim()" aria-label="确认自定义场地" @tap="chooseVenue(manualVenue)">确定</button>
          </view>
        </view>
        <view v-if="venues.length" class="selection-section">
          <text class="selection-section__title">{{ venueSearch ? '搜索结果' : '推荐场地' }}</text>
          <button
            v-for="venue in venues"
            :key="venue"
            class="selection-row"
            :aria-label="`选择场地${venue}`"
            @tap="chooseVenue(venue)"
          >
            <text>{{ venue }}</text><AppIcon name="chevron" />
          </button>
        </view>
        <view v-else class="selection-empty">暂无收录场地，可以使用“手动添加场地”。</view>
      </scroll-view>
    </template>
  </view>
</template>

<style scoped>
.location-picker-screen { position: fixed; z-index: 60; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.location-picker-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 28rpx 28rpx calc(60rpx + env(safe-area-inset-bottom)); }
.location-intro { display: flex; padding: 24rpx; align-items: center; gap: 20rpx; border-radius: 20rpx; background: var(--color-accent-soft); }
.location-intro__icon { width: 48rpx; height: 48rpx; flex: none; color: var(--color-accent); }
.location-intro__title, .location-intro__description { display: block; }
.location-intro__title { color: var(--color-text); font-size: 27rpx; font-weight: 700; }
.location-intro__description { margin-top: 7rpx; color: var(--color-muted); font-size: 21rpx; line-height: 1.45; }
.location-form-card { margin-top: 26rpx; overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 22rpx; background: var(--color-surface); }
.location-row { display: flex; width: 100%; min-height: 118rpx; margin: 0; padding: 20rpx 24rpx; align-items: center; border: 0; border-top: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.location-row:first-child { border-top: 0; }
.location-row::after, .location-confirm::after, .region-tab::after, .manual-toggle::after, .manual-form button::after, .selection-row::after { border: 0; }
.location-row__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.location-row__label { color: var(--color-muted); font-size: 21rpx; }
.location-row__value { margin-top: 8rpx; overflow: hidden; color: var(--color-text); font-size: 28rpx; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.location-row__value--placeholder { color: var(--color-accent); font-weight: 560; }
.location-row__chevron { width: 32rpx; height: 32rpx; flex: none; color: var(--color-muted); }
.location-preview { display: flex; margin-top: 22rpx; padding: 22rpx 24rpx; flex-direction: column; border-radius: 18rpx; background: var(--color-row-pressed); }
.location-preview__label { color: var(--color-muted); font-size: 21rpx; }
.location-preview__value { margin-top: 7rpx; color: var(--color-text); font-size: 27rpx; font-weight: 650; }
.location-confirm { height: 88rpx; margin: 32rpx 0 0; border: 0; border-radius: 20rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 29rpx; font-weight: 680; line-height: 88rpx; }
.location-confirm[disabled] { background: var(--color-border); color: var(--color-muted); }
.region-tabs { display: grid; margin: 22rpx 28rpx 16rpx; padding: 6rpx; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6rpx; border-radius: 18rpx; background: var(--color-row-pressed); }
.region-tab { height: 62rpx; margin: 0; padding: 0; border: 0; border-radius: 14rpx; background: transparent; color: var(--color-muted); font-size: 24rpx; line-height: 62rpx; }
.region-tab--active { background: var(--color-surface); color: var(--color-accent); font-weight: 680; box-shadow: 0 4rpx 14rpx var(--color-tab-shadow); }
.location-search { display: flex; height: 74rpx; margin: 0 28rpx 18rpx; padding: 0 18rpx; align-items: center; gap: 13rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 17rpx; background: var(--color-surface); }
.location-search > :first-child { width: 32rpx; height: 32rpx; flex: none; color: var(--color-muted); }
.location-search input { min-width: 0; height: 74rpx; flex: 1; color: var(--color-text); font-size: 25rpx; }
.selection-list { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 174rpx); padding: 0 28rpx calc(44rpx + env(safe-area-inset-bottom)); }
.selection-list--venue { height: calc(100vh - var(--app-header-height) - 164rpx); }
.manual-section, .selection-section { margin-bottom: 20rpx; overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 20rpx; background: var(--color-surface); }
.manual-toggle { display: flex; width: 100%; height: 78rpx; margin: 0; padding: 0 22rpx; align-items: center; gap: 12rpx; border: 0; background: transparent; color: var(--color-accent); font-size: 24rpx; text-align: left; }
.manual-toggle > :first-child { width: 30rpx; height: 30rpx; }
.manual-form { display: flex; padding: 0 18rpx 18rpx; gap: 12rpx; }
.manual-form input { box-sizing: border-box; min-width: 0; height: 70rpx; padding: 0 16rpx; flex: 1; border: var(--app-border-width) solid var(--color-border); border-radius: 14rpx; color: var(--color-text); font-size: 24rpx; }
.manual-form button { width: 104rpx; height: 70rpx; margin: 0; padding: 0; border: 0; border-radius: 14rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 23rpx; line-height: 70rpx; }
.manual-form button[disabled] { background: var(--color-border); color: var(--color-muted); }
.selection-section__title { display: block; padding: 16rpx 20rpx 12rpx; color: var(--color-accent); font-size: 21rpx; font-weight: 700; }
.selection-row { display: flex; width: 100%; min-height: 76rpx; margin: 0; padding: 0 20rpx; align-items: center; gap: 16rpx; border: 0; border-top: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); font-size: 25rpx; text-align: left; }
.selection-row > text { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selection-row > :last-child { width: 27rpx; height: 27rpx; flex: none; color: var(--color-muted); }
.selection-empty { padding: 70rpx 28rpx; color: var(--color-muted); font-size: 23rpx; line-height: 1.55; text-align: center; }
.venue-city-banner { display: flex; margin: 22rpx 28rpx 16rpx; padding: 18rpx 20rpx; align-items: center; justify-content: space-between; border-radius: 17rpx; background: var(--color-accent-soft); color: var(--color-muted); font-size: 22rpx; }
.venue-city-banner > text:last-child { color: var(--color-accent); font-size: 25rpx; font-weight: 680; }
</style>
