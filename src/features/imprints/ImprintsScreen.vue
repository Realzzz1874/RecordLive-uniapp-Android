<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import AppHeader from '@/components/AppHeader.vue'
import type { Performance } from '@/domain/performance'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import ImprintFilterSheet from '@/features/imprints/ImprintFilterSheet.vue'
import ImprintMonthView from '@/features/imprints/ImprintMonthView.vue'
import ImprintRanksView from '@/features/imprints/ImprintRanksView.vue'
import ImprintYearView from '@/features/imprints/ImprintYearView.vue'
import {
  filterImprintPerformances,
  ImprintQueryService,
  type ImprintFilter,
} from '@/features/imprints/model'
import { ALL_PERFORMANCE_LIFECYCLES } from '@/features/preferences/model'
import { getAppRepositories } from '@/platform/repositories/context'
import { useImprintPreferencesStore } from '@/stores/imprint-preferences'

const props = defineProps<{
  theme: 'light' | 'dark'
  refreshKey: number
}>()

const emit = defineEmits<{
  add: [startedAtMs: number]
  open: [id: string]
  openArtist: [name: string, performanceIds: string[]]
  openPlay: [name: string, performanceIds: string[]]
}>()

const imprintPreferencesStore = useImprintPreferencesStore()
const {
  filter,
  alwaysShowDate,
  showPerformanceTime,
  showExpenseAmounts,
  activeSection,
  rankView,
} = storeToRefs(imprintPreferencesStore)
const performances = ref<Performance[]>([])
const categories = ref<PerformanceCategory[]>([])
const tags = ref<PerformanceTag[]>([])
const loading = ref(true)
const filterVisible = ref(false)
let requestSequence = 0

const filteredPerformances = computed(() => filterImprintPerformances(
  performances.value,
  filter.value,
))
const filteredPerformanceIds = computed(() => filteredPerformances.value.map(({ id }) => id))
const rankDetailTitle = computed(() => ({
  'artist-times': '阵容次数排行',
  'artist-expense': '阵容花费排行',
  'play-times': '剧目/主题次数排行',
  'play-expense': '剧目/主题花费排行',
  overview: '榜榜榜',
}[rankView.value]))
const activeFilterCount = computed(() => (
  (filter.value.categoryIds.length ? 1 : 0)
  + (filter.value.tagIds.length ? 1 : 0)
  + (filter.value.lifecycles.length === ALL_PERFORMANCE_LIFECYCLES.length ? 0 : 1)
))

onMounted(async () => {
  await imprintPreferencesStore.initialize()
  await load()
})
watch(() => props.refreshKey, load)

async function load(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    const [snapshot, categoryItems, tagItems] = await Promise.all([
      new ImprintQueryService(repositories.performances).loadSnapshot(),
      repositories.referenceData.listCategories(),
      repositories.referenceData.listTags(),
    ])
    if (sequence !== requestSequence) return
    performances.value = snapshot.performances
    categories.value = categoryItems
    tags.value = tagItems
    removeUnavailableFilterValues(categoryItems, tagItems)
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

function removeUnavailableFilterValues(
  categoryItems: PerformanceCategory[],
  tagItems: PerformanceTag[],
): void {
  const categoryIds = new Set(categoryItems.map(({ id }) => id))
  const tagIds = new Set(tagItems.map(({ id }) => id))
  const normalizedFilter: ImprintFilter = {
    categoryIds: filter.value.categoryIds.filter((id) => categoryIds.has(id)),
    tagIds: filter.value.tagIds.filter((id) => tagIds.has(id)),
    lifecycles: [...filter.value.lifecycles],
  }
  if (JSON.stringify(normalizedFilter) === JSON.stringify(filter.value)) return
  imprintPreferencesStore.setPreferences(
    normalizedFilter,
    alwaysShowDate.value,
    showPerformanceTime.value,
  )
}

function applyPreferences(
  nextFilter: ImprintFilter,
  nextAlwaysShowDate: boolean,
  nextShowPerformanceTime: boolean,
): void {
  imprintPreferencesStore.setPreferences(
    nextFilter,
    nextAlwaysShowDate,
    nextShowPerformanceTime,
  )
}

function openArtistDetail(name: string): void {
  emit('openArtist', name, filteredPerformanceIds.value)
}

function openPlayDetail(name: string): void {
  emit('openPlay', name, filteredPerformanceIds.value)
}
</script>

<template>
  <view class="imprints-screen">
    <AppHeader
      v-if="activeSection === 'ranks' && rankView !== 'overview'"
      :title="rankDetailTitle"
      show-back
      back-label="返回榜榜榜"
      @back="imprintPreferencesStore.setRankView('overview')"
    />
    <AppHeader
      v-else
      title="印记"
      show-filter
      filter-label="筛选印记"
      :filter-count="activeFilterCount"
      @filter="filterVisible = true"
    >
      <template #center>
        <view class="imprints-tabs" aria-label="印记视图">
          <button
            class="imprints-tab"
            :class="{ 'imprints-tab--active': activeSection === 'month' }"
            aria-label="月视图"
            @tap="imprintPreferencesStore.setActiveSection('month')"
          >月</button>
          <button
            class="imprints-tab"
            :class="{ 'imprints-tab--active': activeSection === 'year' }"
            aria-label="年视图"
            @tap="imprintPreferencesStore.setActiveSection('year')"
          >年</button>
          <button
            class="imprints-tab imprints-tab--wide"
            :class="{ 'imprints-tab--active': activeSection === 'ranks' }"
            aria-label="榜榜榜视图"
            @tap="imprintPreferencesStore.setActiveSection('ranks')"
          >榜榜榜</button>
        </view>
      </template>
    </AppHeader>

    <view v-if="loading" class="loading-state">正在整理演出印记…</view>
    <ImprintMonthView
      v-else-if="activeSection === 'month'"
      :performances="filteredPerformances"
      :always-show-date="alwaysShowDate"
      :show-performance-time="showPerformanceTime"
      :show-expense-amounts="showExpenseAmounts"
      @add="$emit('add', $event)"
      @open="$emit('open', $event)"
      @open-artist="openArtistDetail"
      @toggle-expense-amounts="imprintPreferencesStore.setShowExpenseAmounts(!showExpenseAmounts)"
    />
    <ImprintYearView
      v-else-if="activeSection === 'year'"
      :performances="filteredPerformances"
      :show-expense-amounts="showExpenseAmounts"
    />
    <ImprintRanksView
      v-else
      :performances="filteredPerformances"
      :view="rankView"
      :show-expense-amounts="showExpenseAmounts"
      @update-view="imprintPreferencesStore.setRankView"
      @select-artist="openArtistDetail"
      @select-play="openPlayDetail"
    />

    <ImprintFilterSheet
      :visible="filterVisible"
      :show-calendar-settings="activeSection === 'month'"
      :filter="filter"
      :always-show-date="alwaysShowDate"
      :show-performance-time="showPerformanceTime"
      :categories="categories"
      :tags="tags"
      @close="filterVisible = false"
      @apply="applyPreferences"
    />
  </view>
</template>

<style scoped>
.imprints-screen { min-height: 100vh; background: var(--color-background); }
.imprints-tabs { display: grid; width: 100%; height: 64rpx; padding: 4rpx; grid-template-columns: 1fr 1fr 1.6fr; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); }
.imprints-tab { height: 54rpx; margin: 0; padding: 0 12rpx; border: 0; border-radius: 12rpx; background: transparent; color: var(--color-muted); font-size: 23rpx; font-weight: 620; line-height: 54rpx; white-space: nowrap; }
.imprints-tab::after { border: 0; }
.imprints-tab--active { background: var(--color-accent); color: var(--color-on-accent); box-shadow: 0 4rpx 10rpx var(--color-tab-shadow); }
.loading-state { display: flex; min-height: calc(100vh - var(--app-header-height) - 132rpx); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
</style>
