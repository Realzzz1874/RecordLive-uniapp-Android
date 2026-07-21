<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import type { PerformanceLifecycle } from '@/domain/performance'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import {
  ALL_PERFORMANCE_LIFECYCLES,
  DEFAULT_BROWSE_PREFERENCES,
  POSTER_COLUMN_COUNTS,
  POSTER_TEXT_COLUMN_COUNTS,
  type ArtistSortMode,
  type PerformanceDisplayMode,
  type PerformanceFilter,
} from '@/features/preferences/model'

const props = withDefaults(defineProps<{
  visible: boolean
  filter: PerformanceFilter
  displayMode: PerformanceDisplayMode
  artistSortMode: ArtistSortMode
  posterColumnCount: number
  posterTextColumnCount: number
  categories: PerformanceCategory[]
  tags: PerformanceTag[]
  years: number[]
  showLifecycle?: boolean
}>(), {
  showLifecycle: true,
})

const emit = defineEmits<{
  close: []
  apply: [
    filter: PerformanceFilter,
    displayMode: PerformanceDisplayMode,
    posterColumnCount: number,
    posterTextColumnCount: number,
    artistSortMode: ArtistSortMode,
  ]
}>()

const draft = reactive<PerformanceFilter>(cloneFilter(props.filter))
const displayModeDraft = ref<PerformanceDisplayMode>(props.displayMode)
const artistSortModeDraft = ref<ArtistSortMode>(props.artistSortMode)
const posterColumnCountDraft = ref(props.posterColumnCount)
const posterTextColumnCountDraft = ref(props.posterTextColumnCount)
const lifecycleOptions: readonly { value: PerformanceLifecycle; label: string }[] = [
  { value: 'attended', label: '已看' },
  { value: 'upcoming', label: '待看' },
  { value: 'pending-sale', label: '待开票' },
  { value: 'cancelled', label: '已取消' },
  { value: 'missed', label: '未赴约' },
] as const

watch(
  () => [
    props.visible,
    props.filter,
    props.displayMode,
    props.posterColumnCount,
    props.posterTextColumnCount,
    props.artistSortMode,
  ] as const,
  ([visible]) => {
    if (visible) {
      Object.assign(draft, cloneFilter(props.filter))
      displayModeDraft.value = props.displayMode
      artistSortModeDraft.value = props.artistSortMode
      posterColumnCountDraft.value = props.posterColumnCount
      posterTextColumnCountDraft.value = props.posterTextColumnCount
    }
  },
  { deep: true },
)

function toggleStringList(key: 'categoryIds' | 'tagIds', value: string): void {
  const values = draft[key]
  draft[key] = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function toggleLifecycle(value: PerformanceLifecycle): void {
  draft.lifecycles = draft.lifecycles.includes(value)
    ? draft.lifecycles.filter((item) => item !== value)
    : [...draft.lifecycles, value]
}

function reset(): void {
  const resetFilter = cloneFilter(DEFAULT_BROWSE_PREFERENCES.filter)
  if (!props.showLifecycle) resetFilter.lifecycles = [...props.filter.lifecycles]
  Object.assign(draft, resetFilter)
  displayModeDraft.value = DEFAULT_BROWSE_PREFERENCES.displayMode
  artistSortModeDraft.value = DEFAULT_BROWSE_PREFERENCES.artistSortMode
  posterColumnCountDraft.value = DEFAULT_BROWSE_PREFERENCES.posterColumnCount
  posterTextColumnCountDraft.value = DEFAULT_BROWSE_PREFERENCES.posterTextColumnCount
}

function apply(): void {
  emit(
    'apply',
    cloneFilter(draft),
    displayModeDraft.value,
    posterColumnCountDraft.value,
    posterTextColumnCountDraft.value,
    artistSortModeDraft.value,
  )
  emit('close')
}

function cloneFilter(value: PerformanceFilter): PerformanceFilter {
  return {
    categoryIds: [...value.categoryIds],
    tagIds: [...value.tagIds],
    year: value.year,
    lifecycles: [...value.lifecycles],
  }
}
</script>

<template>
  <view v-if="visible" class="filter-layer">
    <button class="filter-scrim" aria-label="关闭筛选" @tap="$emit('close')" />
    <view class="filter-sheet" aria-label="演出筛选面板">
      <view class="filter-header">
        <view>
          <text class="filter-header__title">筛选与显示</text>
          <text class="filter-header__subtitle">选择多项时，分类和标签均按任一命中</text>
        </view>
        <button class="close-button" aria-label="关闭筛选" @tap="$emit('close')"><AppIcon name="close" /></button>
      </view>

      <scroll-view class="filter-content" scroll-y>
        <view class="filter-section">
          <text class="filter-section__title">展示方式</text>
          <view class="display-options" aria-label="展示方式">
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'card' }"
              aria-label="演出卡片1展示"
              @tap="displayModeDraft = 'card'"
            >
              <AppIcon name="image" />
              <text>演出卡片1</text>
            </button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'simple' }"
              aria-label="演出卡片2无海报展示"
              @tap="displayModeDraft = 'simple'"
            >
              <AppIcon name="list" />
              <text>演出卡片2（无海报）</text>
            </button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'timeline' }"
              aria-label="文字时间线展示"
              @tap="displayModeDraft = 'timeline'"
            >
              <AppIcon name="calendar" />
              <text>文字时间线</text>
            </button>
			<button
			  class="display-option"
			  :class="{ 'display-option--selected': displayModeDraft === 'poster' }"
			  aria-label="仅海报展示"
			  @tap="displayModeDraft = 'poster'"
			>
			  <AppIcon name="grid" />
			  <text>仅海报</text>
			</button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'poster-text' }"
              aria-label="海报加演出名称展示"
              @tap="displayModeDraft = 'poster-text'"
            >
              <AppIcon name="image" />
              <text>海报+演出名称</text>
            </button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'artist' }"
              aria-label="阵容展示"
              @tap="displayModeDraft = 'artist'"
            >
              <AppIcon name="award" />
              <text>阵容</text>
            </button>
            <button
              class="display-option"
              :class="{ 'display-option--selected': displayModeDraft === 'play' }"
              aria-label="剧目主题名称展示"
              @tap="displayModeDraft = 'play'"
            >
              <AppIcon name="tag" />
              <text>剧目/主题（名称）</text>
            </button>
            
          </view>
          <view v-if="displayModeDraft === 'poster'" class="poster-column-setting">
            <text class="poster-column-setting__label">每行海报</text>
            <view class="column-options" aria-label="每行海报数量">
              <button
                v-for="count in POSTER_COLUMN_COUNTS"
                :key="count"
                class="column-option"
                :class="{ 'column-option--selected': posterColumnCountDraft === count }"
                :aria-label="`每行${count}张海报`"
                @tap="posterColumnCountDraft = count"
              >{{ count }}</button>
            </view>
          </view>
          <view v-if="displayModeDraft === 'poster-text'" class="poster-column-setting">
            <text class="poster-column-setting__label">每行海报</text>
            <view class="column-options column-options--compact" aria-label="每行海报加名称数量">
              <button
                v-for="count in POSTER_TEXT_COLUMN_COUNTS"
                :key="count"
                class="column-option"
                :class="{ 'column-option--selected': posterTextColumnCountDraft === count }"
                :aria-label="`海报加名称每行${count}张`"
                @tap="posterTextColumnCountDraft = count"
              >{{ count }}</button>
            </view>
          </view>
          <view v-if="displayModeDraft === 'artist' || displayModeDraft === 'play'" class="artist-sort-setting">
            <text class="poster-column-setting__label">{{ displayModeDraft === 'artist' ? '阵容排序' : '剧目/主题排序' }}</text>
            <view class="artist-sort-options" :aria-label="displayModeDraft === 'artist' ? '阵容排序方式' : '剧目主题排序方式'">
              <button
                class="artist-sort-option"
                :class="{ 'artist-sort-option--selected': artistSortModeDraft === 'times' }"
                :aria-label="`${displayModeDraft === 'artist' ? '阵容' : '剧目主题'}按观看次数排序`"
                @tap="artistSortModeDraft = 'times'"
              >按观看次数</button>
              <button
                class="artist-sort-option"
                :class="{ 'artist-sort-option--selected': artistSortModeDraft === 'date' }"
                :aria-label="`${displayModeDraft === 'artist' ? '阵容' : '剧目主题'}按观看日期排序`"
                @tap="artistSortModeDraft = 'date'"
              >按观看日期</button>
            </view>
          </view>
        </view>

        <view v-if="showLifecycle" class="filter-section">
          <text class="filter-section__title">状态</text>
          <view class="chip-list">
            <button
              v-for="option in lifecycleOptions"
              :key="option.value"
              class="filter-chip"
              :class="{ 'filter-chip--selected': draft.lifecycles.includes(option.value) }"
              :aria-label="`筛选状态${option.label}`"
              @tap="toggleLifecycle(option.value)"
            >{{ option.label }}</button>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__title">年份</text>
          <view class="chip-list">
            <button class="filter-chip" :class="{ 'filter-chip--selected': draft.year === null }" @tap="draft.year = null">全部年份</button>
            <button
              v-for="year in years"
              :key="year"
              class="filter-chip"
              :class="{ 'filter-chip--selected': draft.year === year }"
              @tap="draft.year = year"
            >{{ year }}</button>
          </view>
        </view>

        <view v-if="categories.length" class="filter-section">
          <text class="filter-section__title">分类</text>
          <view class="chip-list">
            <button
              v-for="category in categories"
              :key="category.id"
              class="filter-chip"
              :class="{ 'filter-chip--selected': draft.categoryIds.includes(category.id) }"
              @tap="toggleStringList('categoryIds', category.id)"
            >{{ category.name }}</button>
          </view>
        </view>

        <view v-if="tags.length" class="filter-section">
          <text class="filter-section__title">标签</text>
          <view class="chip-list">
            <button
              v-for="tag in tags"
              :key="tag.id"
              class="filter-chip"
              :class="{ 'filter-chip--selected': draft.tagIds.includes(tag.id) }"
              @tap="toggleStringList('tagIds', tag.id)"
            ># {{ tag.name }}</button>
          </view>
        </view>
      </scroll-view>

      <view class="filter-actions">
        <button class="reset-button" @tap="reset">恢复默认</button>
        <button class="apply-button" @tap="apply">查看筛选结果</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.filter-layer { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; }
.filter-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15,10,8,.5); }
.filter-scrim::after, .close-button::after, .filter-chip::after, .display-option::after, .column-option::after, .artist-sort-option::after, .reset-button::after, .apply-button::after { border: 0; }
.filter-sheet { position: relative; z-index: 1; box-sizing: border-box; width: 100%; max-height: 82vh; overflow: hidden; border-radius: 30rpx 30rpx 0 0; background: var(--color-background); box-shadow: 0 -18rpx 60rpx rgba(0,0,0,.2); }
.filter-header { display: flex; min-height: 122rpx; padding: 28rpx 30rpx 22rpx 36rpx; align-items: center; justify-content: space-between; border-bottom: var(--app-border-width) solid var(--color-border); }
.filter-header__title { display: block; color: var(--color-text); font-size: 34rpx; font-weight: 720; }
.filter-header__subtitle { display: block; margin-top: 7rpx; color: var(--color-muted); font-size: 21rpx; }
.close-button { width: 66rpx; height: 66rpx; margin: 0; padding: 18rpx; border: 0; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); }
.filter-content { box-sizing: border-box; max-height: calc(82vh - 122rpx - 120rpx - env(safe-area-inset-bottom)); }
.filter-section { padding: 28rpx 36rpx; border-bottom: var(--app-border-width) solid var(--color-border-subtle); }
.filter-section__title { display: block; margin-bottom: 18rpx; color: var(--color-muted); font-size: 23rpx; font-weight: 620; }
.display-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.display-option { display: flex; min-width: 0; height: 78rpx; margin: 0; padding: 0 15rpx; align-items: center; justify-content: center; gap: 10rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); color: var(--color-muted); font-size: 23rpx; font-weight: 620; }
.display-option > :first-child { width: 31rpx; height: 31rpx; }
.display-option text { min-width: 0; white-space: nowrap; }
.display-option--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); }
.poster-column-setting { margin-top: 24rpx; }
.poster-column-setting__label { display: block; margin-bottom: 13rpx; color: var(--color-muted); font-size: 22rpx; }
.column-options { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 9rpx; }
.column-options--compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.column-option { height: 58rpx; margin: 0; padding: 0; border: var(--app-border-width) solid var(--color-border); border-radius: 12rpx; background: var(--color-surface); color: var(--color-muted); font-size: 23rpx; line-height: 56rpx; }
.column-option--selected { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-on-accent); font-weight: 700; }
.artist-sort-setting { margin-top: 24rpx; }
.artist-sort-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.artist-sort-option { height: 62rpx; margin: 0; padding: 0; border: var(--app-border-width) solid var(--color-border); border-radius: 14rpx; background: var(--color-surface); color: var(--color-muted); font-size: 23rpx; line-height: 60rpx; }
.artist-sort-option--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); font-weight: 650; }
.chip-list { display: flex; flex-wrap: wrap; gap: 13rpx; }
.filter-chip { min-height: 62rpx; margin: 0; padding: 0 22rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 31rpx; background: var(--color-surface); color: var(--color-muted); font-size: 24rpx; line-height: 60rpx; }
.filter-chip--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); font-weight: 620; }
.filter-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 16rpx; padding: 18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: var(--app-border-width) solid var(--color-border); }
.reset-button, .apply-button { height: 82rpx; margin: 0; border-radius: 18rpx; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.reset-button { border: var(--app-border-width) solid var(--color-border); background: var(--color-surface); color: var(--color-muted); }
.apply-button { border: 0; background: var(--color-accent); color: var(--color-on-accent); }
</style>
