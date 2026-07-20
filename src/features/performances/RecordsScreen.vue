<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Performance } from '@/domain/performance'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import PerformanceCard from '@/features/performances/PerformanceCard.vue'
import PerformanceFilterSheet from '@/features/performances/PerformanceFilterSheet.vue'
import {
  ALL_PERFORMANCE_LIFECYCLES,
  yearRange,
  type PerformanceDisplayMode,
  type PerformanceFilter,
} from '@/features/preferences/model'
import { getAppRepositories } from '@/platform/repositories/context'
import { useBrowsePreferencesStore } from '@/stores/browse-preferences'

const props = defineProps<{
  theme: 'light' | 'dark'
  refreshKey: number
}>()

const emit = defineEmits<{
  add: []
  open: [id: string]
}>()

const browseStore = useBrowsePreferencesStore()
const { displayMode, posterColumnCount, filter } = storeToRefs(browseStore)
const items = ref<Performance[]>([])
const total = ref(0)
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const searchExpanded = ref(false)
const searchQuery = ref('')
const searchInputFocused = ref(false)
const filterVisible = ref(false)
const categories = ref<PerformanceCategory[]>([])
const tags = ref<PerformanceTag[]>([])
const years = ref<number[]>([])
let requestSequence = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const headerCount = computed(() => `${total.value}`)
const activeFilterCount = computed(() => (
  (filter.value.categoryIds.length ? 1 : 0)
  + (filter.value.tagIds.length ? 1 : 0)
  + (filter.value.year === null ? 0 : 1)
  + (filter.value.lifecycles.length === ALL_PERFORMANCE_LIFECYCLES.length ? 0 : 1)
))
const emptyIsFiltered = computed(() => Boolean(searchQuery.value) || activeFilterCount.value > 0)

onMounted(async () => {
  await browseStore.initialize()
  await loadMetadata()
  await load(true)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
watch(() => props.refreshKey, () => void refreshAll())
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
    const range = yearRange(filter.value.year)
    const page = await repositories.performances.list({
      search: searchQuery.value,
      categoryIds: filter.value.categoryIds.length ? filter.value.categoryIds : undefined,
      tagIdsAny: filter.value.tagIds.length ? filter.value.tagIds : undefined,
      lifecycles: filter.value.lifecycles.length === ALL_PERFORMANCE_LIFECYCLES.length
        ? undefined
        : filter.value.lifecycles,
      referenceTimeMs: Date.now(),
      ...range,
      sortDirection: 'descending',
      offset,
      limit: 30,
    })
    if (sequence !== requestSequence) return
    items.value = reset ? page.items : [...items.value, ...page.items]
    total.value = page.total
    hasMore.value = page.hasMore
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

async function loadMetadata(): Promise<void> {
  try {
    const repositories = await getAppRepositories()
    const [categoryItems, tagItems, allPerformances] = await Promise.all([
      repositories.referenceData.listCategories(),
      repositories.referenceData.listTags(),
      repositories.performances.list({ limit: 1000 }),
    ])
    categories.value = categoryItems
    tags.value = tagItems
    years.value = [...new Set(allPerformances.items.map(
      ({ startedAtMs }) => new Date(startedAtMs).getFullYear(),
    ))].sort((left, right) => right - left)
    const categoryIds = new Set(categoryItems.map(({ id }) => id))
    const tagIds = new Set(tagItems.map(({ id }) => id))
    const normalizedFilter: PerformanceFilter = {
      ...filter.value,
      categoryIds: filter.value.categoryIds.filter((id) => categoryIds.has(id)),
      tagIds: filter.value.tagIds.filter((id) => tagIds.has(id)),
      year: filter.value.year !== null && !years.value.includes(filter.value.year)
        ? null
        : filter.value.year,
      lifecycles: [...filter.value.lifecycles],
    }
    if (JSON.stringify(normalizedFilter) !== JSON.stringify(filter.value)) {
      browseStore.setFilter(normalizedFilter)
    }
  } catch {
    // Main list loading surfaces repository failures.
  }
}

async function refreshAll(): Promise<void> {
  await loadMetadata()
  await load(true)
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

function applyFilter(value: PerformanceFilter, mode: PerformanceDisplayMode, columns: number): void {
  browseStore.setFilter(value)
  browseStore.setDisplayMode(mode)
  browseStore.setPosterColumnCount(columns)
  void load(true)
}

function clearFilters(): void {
  browseStore.resetFilter()
  void load(true)
}
</script>

<template>
  <view class="records-screen">
    <AppHeader
      title="记录现场"
      :count="headerCount"
      show-filter
      :filter-count="activeFilterCount"
      show-search
      show-add
      @filter="filterVisible = true"
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
        <button v-if="searchQuery" class="search-clear" aria-label="清空搜索" @tap="clearSearch"><AppIcon name="close" /></button>
      </view>
      <button class="search-cancel" @tap="closeSearch">取消</button>
    </view>

    <view v-if="loading" class="loading-state">正在读取演出记录…</view>
    <EmptyState
      v-else-if="total === 0 && !emptyIsFiltered"
      kind="records"
      :theme="theme"
      title="还没有演出记录"
      description="记录看过的现场，让每一次心动都有迹可循"
      action-label="记录第一场演出"
      @action="$emit('add')"
    />
    <view v-else-if="total === 0" class="search-empty">
      <view class="search-empty__icon"><AppIcon name="filter" /></view>
      <text class="search-empty__title">没有符合条件的演出</text>
      <text class="search-empty__description">调整搜索词或筛选条件后再试试</text>
      <button v-if="activeFilterCount" class="empty-reset" @tap="clearFilters">清除筛选</button>
    </view>
    <scroll-view v-else class="records-list" scroll-y lower-threshold="120" @scrolltolower="load(false)">
      <view
        class="performance-collection"
        :class="{ 'performance-collection--poster': displayMode === 'poster' }"
        :style="displayMode === 'poster' ? { gridTemplateColumns: `repeat(${posterColumnCount}, minmax(0, 1fr))` } : undefined"
      >
        <PerformanceCard
          v-for="performance in items"
          :key="performance.id"
          :performance="performance"
          :mode="displayMode"
          @open="$emit('open', $event)"
        />
      </view>
      <text v-if="loadingMore" class="list-footer">正在加载…</text>
      <text v-else-if="!hasMore" class="list-footer">共 {{ total }} 场演出</text>
    </scroll-view>

    <PerformanceFilterSheet
      :visible="filterVisible"
      :filter="filter"
      :display-mode="displayMode"
      :poster-column-count="posterColumnCount"
      :categories="categories"
      :tags="tags"
      :years="years"
      @close="filterVisible = false"
      @apply="applyFilter"
    />
  </view>
</template>

<style scoped>
.records-screen { min-height: 100vh; background: var(--color-background); }
.search-bar { display: flex; gap: 18rpx; padding: 20rpx 30rpx; align-items: center; border-bottom: 1rpx solid var(--color-border); }
.search-field { display: flex; min-width: 0; height: 76rpx; padding: 0 18rpx; flex: 1; align-items: center; gap: 14rpx; border: 1rpx solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.search-field > :first-child { width: 34rpx; height: 34rpx; flex: none; color: var(--color-muted); }
.search-input { min-width: 0; height: 76rpx; flex: 1; color: var(--color-text); font-size: 27rpx; }
.search-clear, .search-cancel, .empty-reset { margin: 0; padding: 0; border: 0; background: transparent; }
.search-clear::after, .search-cancel::after, .empty-reset::after { border: 0; }
.search-clear { width: 52rpx; height: 52rpx; padding: 15rpx; color: var(--color-muted); }
.search-cancel { color: var(--color-accent); font-size: 27rpx; line-height: 76rpx; }
.loading-state, .search-empty { display: flex; min-height: calc(100vh - var(--app-header-height) - 132rpx); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.search-empty { flex-direction: column; padding: 80rpx 40rpx 180rpx; text-align: center; }
.search-empty__icon { width: 82rpx; height: 82rpx; color: var(--color-accent); opacity: .72; }
.search-empty__title { margin-top: 28rpx; color: var(--color-text); font-size: 32rpx; font-weight: 650; }
.search-empty__description { margin-top: 12rpx; font-size: 25rpx; }
.empty-reset { height: 72rpx; margin-top: 26rpx; padding: 0 26rpx; border: 1rpx solid var(--color-accent); border-radius: 18rpx; color: var(--color-accent); font-size: 25rpx; line-height: 70rpx; }
.records-list { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 132rpx - env(safe-area-inset-bottom)); padding: 22rpx 26rpx 40rpx; }
.search-bar ~ .records-list { height: calc(100vh - var(--app-header-height) - 116rpx - 132rpx - env(safe-area-inset-bottom)); }
.performance-collection { display: flex; flex-direction: column; gap: 18rpx; }
.performance-collection--poster { display: grid; gap: 8rpx; transition: grid-template-columns 180ms ease; }
.list-footer { display: block; padding: 22rpx 0 40rpx; color: var(--color-muted); font-size: 23rpx; text-align: center; }
</style>
