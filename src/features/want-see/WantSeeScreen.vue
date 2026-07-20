<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Performance } from '@/domain/performance'
import PerformanceBrowseToolbar from '@/features/performances/PerformanceBrowseToolbar.vue'
import PerformanceCard from '@/features/performances/PerformanceCard.vue'
import type { PerformanceDisplayMode } from '@/features/preferences/model'
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
const { displayMode } = storeToRefs(browseStore)
const items = ref<Performance[]>([])
const total = ref(0)
const loading = ref(true)
const searchExpanded = ref(false)
const searchQuery = ref('')
const searchInputFocused = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSequence = 0

const headerCount = computed(() => `${total.value} 场`)

onMounted(async () => {
  await browseStore.initialize()
  await load()
})
onBeforeUnmount(() => clearTimeout(searchTimer))
watch(() => props.refreshKey, () => void load())
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(), 220)
})

async function load(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    const page = await repositories.performances.list({
      search: searchQuery.value,
      lifecycles: ['upcoming', 'pending-sale'],
      referenceTimeMs: Date.now(),
      sortDirection: 'ascending',
      limit: 200,
    })
    if (sequence !== requestSequence) return
    items.value = page.items
    total.value = page.total
  } catch (error) {
    if (sequence !== requestSequence) return
    uni.showToast({
      title: error instanceof Error ? error.message : '加载待看演出失败',
      icon: 'none',
    })
  } finally {
    if (sequence === requestSequence) loading.value = false
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

function setDisplayMode(value: PerformanceDisplayMode): void {
  browseStore.setDisplayMode(value)
}
</script>

<template>
  <view class="want-see-screen">
    <AppHeader
      title="待看"
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
          aria-label="搜索待看"
          :focus="searchInputFocused"
          confirm-type="search"
          placeholder="搜索待看演出"
        >
      </view>
      <button class="search-cancel" @tap="closeSearch">取消</button>
    </view>

    <PerformanceBrowseToolbar
      :display-mode="displayMode"
      :show-filter="false"
      @display-mode="setDisplayMode"
    />

    <view v-if="loading" class="loading-state">正在读取待看演出…</view>
    <EmptyState
      v-else-if="total === 0 && !searchQuery"
      kind="want-see"
      :theme="theme"
      title="暂无待看的演出"
      description="未来的正常演出与待开票演出会出现在这里"
      action-label="添加待看演出"
      action-style="outlined"
      @action="$emit('add')"
    />
    <view v-else-if="total === 0" class="search-empty">
      <view class="search-empty__icon"><AppIcon name="search" /></view>
      <text class="search-empty__title">没有匹配的待看演出</text>
      <text class="search-empty__description">换个名称、城市或阵容试试</text>
    </view>
    <scroll-view v-else class="want-see-list" scroll-y>
      <view class="performance-collection" :class="{ 'performance-collection--poster': displayMode === 'poster' }">
        <PerformanceCard
          v-for="performance in items"
          :key="performance.id"
          :performance="performance"
          :mode="displayMode"
          @open="$emit('open', $event)"
        />
      </view>
      <text class="list-footer">共 {{ total }} 场待看演出</text>
    </scroll-view>
  </view>
</template>

<style scoped>
.want-see-screen { min-height: 100vh; background: var(--color-background); }
.search-bar { display: flex; gap: 18rpx; padding: 20rpx 30rpx; align-items: center; border-bottom: 1rpx solid var(--color-border); }
.search-field { display: flex; min-width: 0; height: 76rpx; padding: 0 18rpx; flex: 1; align-items: center; gap: 14rpx; border: 1rpx solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.search-field > :first-child { width: 34rpx; height: 34rpx; flex: none; color: var(--color-muted); }
.search-input { min-width: 0; height: 76rpx; flex: 1; color: var(--color-text); font-size: 27rpx; }
.search-cancel { margin: 0; padding: 0; border: 0; background: transparent; color: var(--color-accent); font-size: 27rpx; line-height: 76rpx; }
.search-cancel::after { border: 0; }
.loading-state, .search-empty { display: flex; min-height: calc(100vh - 460rpx); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.search-empty { flex-direction: column; padding: 80rpx 40rpx 180rpx; text-align: center; }
.search-empty__icon { width: 82rpx; height: 82rpx; color: var(--color-accent); opacity: .72; }
.search-empty__title { margin-top: 28rpx; color: var(--color-text); font-size: 32rpx; font-weight: 650; }
.search-empty__description { margin-top: 12rpx; font-size: 25rpx; }
.want-see-list { box-sizing: border-box; height: calc(100vh - 236rpx - 92rpx - 132rpx - env(safe-area-inset-bottom)); padding: 22rpx 26rpx 40rpx; }
.search-bar ~ .want-see-list { height: calc(100vh - 236rpx - 116rpx - 92rpx - 132rpx - env(safe-area-inset-bottom)); }
.performance-collection { display: flex; flex-direction: column; gap: 18rpx; }
.performance-collection--poster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; }
.list-footer { display: block; padding: 22rpx 0 40rpx; color: var(--color-muted); font-size: 23rpx; text-align: center; }
</style>
