<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Performance } from '@/domain/performance'
import {
  formatPerformanceDate,
  formatPerformanceLocation,
  performanceLifecycleLabel,
  performanceMediaPath,
} from '@/features/performances/browser'
import { getAppRepositories } from '@/platform/repositories/context'

const props = defineProps<{
  theme: 'light' | 'dark'
  refreshKey: number
}>()

const emit = defineEmits<{
  add: []
  open: [id: string]
  loaded: [total: number]
}>()

const items = ref<Performance[]>([])
const total = ref(0)
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const searchExpanded = ref(false)
const searchQuery = ref('')
const searchInputFocused = ref(false)
let requestSequence = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const headerCount = computed(() => `${total.value} 场`)

onMounted(() => void load(true))
onBeforeUnmount(() => clearTimeout(searchTimer))
watch(() => props.refreshKey, () => void load(true))
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(true), 220)
})

async function load(reset: boolean): Promise<void> {
  if (!reset && (!hasMore.value || loadingMore.value)) return
  const sequence = ++requestSequence
  reset ? loading.value = true : loadingMore.value = true
  try {
    const repositories = await getAppRepositories()
    const offset = reset ? 0 : items.value.length
    const page = await repositories.performances.list({
      search: searchQuery.value,
      sortDirection: 'descending',
      offset,
      limit: 30,
    })
    if (sequence !== requestSequence) return
    items.value = reset ? page.items : [...items.value, ...page.items]
    total.value = page.total
    hasMore.value = page.hasMore
    emit('loaded', page.total)
  } catch (error) {
    if (sequence !== requestSequence) return
    uni.showToast({
      title: error instanceof Error ? error.message : '加载演出失败',
      icon: 'none',
    })
  } finally {
    if (sequence === requestSequence) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

async function toggleSearch(): Promise<void> {
  if (searchExpanded.value) {
    closeSearch()
    return
  }
  searchExpanded.value = true
  await nextTick()
  searchInputFocused.value = true
}

function closeSearch(): void {
  searchExpanded.value = false
  searchInputFocused.value = false
  searchQuery.value = ''
}

function clearSearch(): void {
  searchQuery.value = ''
  searchInputFocused.value = true
}

function shortMonth(timestamp: number): string {
  return `${new Date(timestamp).getMonth() + 1}月`
}

function day(timestamp: number): string {
  return String(new Date(timestamp).getDate()).padStart(2, '0')
}
</script>

<template>
  <view class="records-screen">
    <AppHeader
      title="记录现场"
      :count="headerCount"
      show-search
      show-add
      @search="toggleSearch"
      @add="$emit('add')"
    />

    <view v-if="searchExpanded" class="search-bar">
      <view class="search-field">
        <AppIcon name="search" />
        <input
          v-model="searchQuery"
          class="search-input"
          aria-label="搜索关键词"
          :focus="searchInputFocused"
          confirm-type="search"
          placeholder="搜索名称、阵容、城市、场馆、剧目…"
        >
        <button v-if="searchQuery" class="search-clear" aria-label="清空搜索" @tap="clearSearch">
          <AppIcon name="close" />
        </button>
      </view>
      <button class="search-cancel" @tap="closeSearch">取消</button>
    </view>

    <view v-if="loading" class="loading-state">正在读取演出记录…</view>
    <EmptyState
      v-else-if="total === 0 && !searchQuery"
      kind="records"
      :theme="theme"
      title="还没有演出记录"
      description="记录看过的现场，让每一次心动都有迹可循"
      action-label="记录第一场演出"
      @action="$emit('add')"
    />
    <view v-else-if="total === 0" class="search-empty">
      <view class="search-empty__icon"><AppIcon name="search" /></view>
      <text class="search-empty__title">没有匹配的演出</text>
      <text class="search-empty__description">换个名称、阵容、城市或场馆试试</text>
    </view>
    <scroll-view v-else class="records-list" scroll-y lower-threshold="120" @scrolltolower="load(false)">
      <button
        v-for="performance in items"
        :key="performance.id"
        class="performance-card"
        hover-class="performance-card--pressed"
        @tap="$emit('open', performance.id)"
      >
        <view class="performance-card__date">
          <text class="performance-card__day">{{ day(performance.startedAtMs) }}</text>
          <text class="performance-card__month">{{ shortMonth(performance.startedAtMs) }}</text>
        </view>
        <image
          v-if="performanceMediaPath(performance, 'poster')"
          class="performance-card__poster"
          :src="performanceMediaPath(performance, 'poster')"
          mode="aspectFill"
        />
        <view v-else class="performance-card__poster performance-card__poster--empty">
          <AppIcon name="ticket" />
        </view>
        <view class="performance-card__content">
          <view class="performance-card__title-row">
            <text class="performance-card__title">{{ performance.name }}</text>
            <text class="status-pill">{{ performanceLifecycleLabel(performance) }}</text>
          </view>
          <text class="performance-card__meta">{{ formatPerformanceDate(performance.startedAtMs, true) }}</text>
          <text class="performance-card__meta">{{ formatPerformanceLocation(performance) }}</text>
          <text v-if="performance.facets.artist?.length" class="performance-card__artist">
            {{ performance.facets.artist.join('、') }}
          </text>
        </view>
        <view class="performance-card__chevron"><AppIcon name="chevron" /></view>
      </button>

      <text v-if="loadingMore" class="list-footer">正在加载…</text>
      <text v-else-if="!hasMore" class="list-footer">共 {{ total }} 场演出</text>
    </scroll-view>
  </view>
</template>

<style scoped>
.records-screen { min-height: 100vh; background: var(--color-background); }
.search-bar { display: flex; gap: 18rpx; padding: 20rpx 30rpx; align-items: center; border-bottom: 1rpx solid var(--color-border); }
.search-field { display: flex; min-width: 0; height: 76rpx; padding: 0 18rpx; flex: 1; align-items: center; gap: 14rpx; border: 1rpx solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.search-field > :first-child { width: 34rpx; height: 34rpx; flex: none; color: var(--color-muted); }
.search-input { min-width: 0; height: 76rpx; flex: 1; color: var(--color-text); font-size: 27rpx; }
.search-clear, .search-cancel { margin: 0; padding: 0; border: 0; background: transparent; }
.search-clear::after, .search-cancel::after, .performance-card::after { border: 0; }
.search-clear { width: 52rpx; height: 52rpx; padding: 15rpx; color: var(--color-muted); }
.search-cancel { color: var(--color-accent); font-size: 27rpx; line-height: 76rpx; }
.loading-state, .search-empty { display: flex; min-height: calc(100vh - 368rpx); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.search-empty { flex-direction: column; padding: 80rpx 40rpx 180rpx; text-align: center; }
.search-empty__icon { width: 82rpx; height: 82rpx; color: var(--color-accent); opacity: 0.72; }
.search-empty__title { margin-top: 28rpx; color: var(--color-text); font-size: 32rpx; font-weight: 650; }
.search-empty__description { margin-top: 12rpx; font-size: 25rpx; }
.records-list { box-sizing: border-box; height: calc(100vh - 236rpx - 132rpx - env(safe-area-inset-bottom)); padding: 22rpx 26rpx 40rpx; }
.search-bar + .loading-state, .search-bar ~ .records-list { height: calc(100vh - 236rpx - 116rpx - 132rpx - env(safe-area-inset-bottom)); }
.performance-card { box-sizing: border-box; display: flex; width: 100%; min-height: 176rpx; margin: 0 0 18rpx; padding: 18rpx; align-items: center; gap: 18rpx; border: 1rpx solid var(--color-border); border-radius: 22rpx; background: var(--color-surface); color: var(--color-text); text-align: left; box-shadow: 0 8rpx 24rpx var(--color-tab-shadow); }
.performance-card--pressed { background: var(--color-row-pressed); transform: scale(0.99); }
.performance-card__date { display: flex; width: 68rpx; flex: none; flex-direction: column; align-items: center; }
.performance-card__day { color: var(--color-accent); font-size: 38rpx; font-weight: 750; line-height: 1; }
.performance-card__month { margin-top: 8rpx; color: var(--color-muted); font-size: 21rpx; }
.performance-card__poster { width: 104rpx; height: 136rpx; flex: none; border-radius: 14rpx; background: var(--color-accent-soft); }
.performance-card__poster--empty { display: flex; align-items: center; justify-content: center; color: var(--color-accent); }
.performance-card__poster--empty > :first-child { width: 48rpx; height: 48rpx; }
.performance-card__content { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.performance-card__title-row { display: flex; min-width: 0; align-items: center; gap: 12rpx; }
.performance-card__title { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text); font-size: 30rpx; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.status-pill { flex: none; padding: 5rpx 12rpx; border-radius: 18rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 20rpx; }
.performance-card__meta, .performance-card__artist { margin-top: 7rpx; overflow: hidden; color: var(--color-muted); font-size: 23rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.performance-card__artist { color: var(--color-accent); }
.performance-card__chevron { width: 28rpx; height: 28rpx; flex: none; color: var(--color-muted); }
.list-footer { display: block; padding: 22rpx 0 40rpx; color: var(--color-muted); font-size: 23rpx; text-align: center; }
</style>
