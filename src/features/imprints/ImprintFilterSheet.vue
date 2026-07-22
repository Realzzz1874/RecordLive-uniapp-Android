<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import type { PerformanceLifecycle } from '@/domain/performance'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import {
  cloneImprintPreferences,
  DEFAULT_IMPRINT_PREFERENCES,
  type ImprintFilter,
} from '@/features/imprints/model'

interface SwitchChangeEvent {
  detail: { value: boolean }
}

const props = defineProps<{
  visible: boolean
  filter: ImprintFilter
  alwaysShowDate: boolean
  showPerformanceTime: boolean
  categories: PerformanceCategory[]
  tags: PerformanceTag[]
}>()

const emit = defineEmits<{
  close: []
  apply: [filter: ImprintFilter, alwaysShowDate: boolean, showPerformanceTime: boolean]
}>()

const draft = reactive<ImprintFilter>(cloneFilter(props.filter))
const alwaysShowDateDraft = ref(props.alwaysShowDate)
const showPerformanceTimeDraft = ref(props.showPerformanceTime)
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
    props.alwaysShowDate,
    props.showPerformanceTime,
  ] as const,
  ([visible]) => {
    if (!visible) return
    Object.assign(draft, cloneFilter(props.filter))
    alwaysShowDateDraft.value = props.alwaysShowDate
    showPerformanceTimeDraft.value = props.showPerformanceTime
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

function updateAlwaysShowDate(event: Event): void {
  alwaysShowDateDraft.value = Boolean((event as unknown as SwitchChangeEvent).detail.value)
}

function updateShowPerformanceTime(event: Event): void {
  showPerformanceTimeDraft.value = Boolean((event as unknown as SwitchChangeEvent).detail.value)
}

function reset(): void {
  const defaults = cloneImprintPreferences(DEFAULT_IMPRINT_PREFERENCES)
  Object.assign(draft, defaults.filter)
  alwaysShowDateDraft.value = defaults.alwaysShowDate
  showPerformanceTimeDraft.value = defaults.showPerformanceTime
}

function apply(): void {
  emit(
    'apply',
    cloneFilter(draft),
    alwaysShowDateDraft.value,
    showPerformanceTimeDraft.value,
  )
  emit('close')
}

function cloneFilter(value: ImprintFilter): ImprintFilter {
  return {
    categoryIds: [...value.categoryIds],
    tagIds: [...value.tagIds],
    lifecycles: [...value.lifecycles],
  }
}
</script>

<template>
  <view v-if="visible" class="filter-layer">
    <button class="filter-scrim" aria-label="关闭印记筛选" @tap="$emit('close')" />
    <view class="filter-sheet" aria-label="印记筛选面板">
      <view class="filter-header">
        <view>
          <text class="filter-header__title">筛选与日历显示</text>
          <text class="filter-header__subtitle">仅影响印记页面，不与其它页面的筛选同步</text>
        </view>
        <button class="close-button" aria-label="关闭印记筛选" @tap="$emit('close')">
          <AppIcon name="close" />
        </button>
      </view>

      <scroll-view class="filter-content" scroll-y>
        <view class="filter-section">
          <text class="filter-section__title">分类</text>
          <view class="chip-list" aria-label="按分类筛选印记">
            <button
              class="filter-chip"
              :class="{ 'filter-chip--selected': !draft.categoryIds.length }"
              @tap="draft.categoryIds = []"
            >全部分类</button>
            <button
              v-for="category in categories"
              :key="category.id"
              class="filter-chip"
              :class="{ 'filter-chip--selected': draft.categoryIds.includes(category.id) }"
              @tap="toggleStringList('categoryIds', category.id)"
            >{{ category.name }}</button>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__title">标签</text>
          <view class="chip-list" aria-label="按标签筛选印记">
            <button
              class="filter-chip"
              :class="{ 'filter-chip--selected': !draft.tagIds.length }"
              @tap="draft.tagIds = []"
            >全部标签</button>
            <button
              v-for="tag in tags"
              :key="tag.id"
              class="filter-chip"
              :class="{ 'filter-chip--selected': draft.tagIds.includes(tag.id) }"
              @tap="toggleStringList('tagIds', tag.id)"
            ># {{ tag.name }}</button>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__title">状态</text>
          <view class="chip-list" aria-label="按状态筛选印记">
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

        <view class="filter-section filter-section--calendar">
          <text class="filter-section__title">日历显示设置</text>
          <view class="setting-row">
            <view class="setting-row__copy">
              <text class="setting-row__label">始终显示日期</text>
              <text class="setting-row__supporting">该日期有演出时也居中显示日期数字</text>
            </view>
            <switch
              :checked="alwaysShowDateDraft"
              aria-label="日历始终显示日期"
              color="#a74f17"
              @change="updateAlwaysShowDate"
            />
          </view>
          <view class="setting-row setting-row--separated">
            <view class="setting-row__copy">
              <text class="setting-row__label">显示演出时间</text>
              <text class="setting-row__supporting">在演出格底部显示时:分</text>
            </view>
            <switch
              :checked="showPerformanceTimeDraft"
              aria-label="日历显示演出时间"
              color="#a74f17"
              @change="updateShowPerformanceTime"
            />
          </view>
        </view>
      </scroll-view>

      <view class="filter-actions">
        <button class="reset-button" @tap="reset">恢复默认</button>
        <button class="apply-button" @tap="apply">应用</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.filter-layer { position: fixed; z-index: 40; inset: 0; display: flex; align-items: flex-end; }
.filter-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15,10,8,.5); }
.filter-scrim::after, .close-button::after, .filter-chip::after, .reset-button::after, .apply-button::after { border: 0; }
.filter-sheet { position: relative; z-index: 1; box-sizing: border-box; width: 100%; max-height: 82vh; overflow: hidden; border-radius: 30rpx 30rpx 0 0; background: var(--color-background); box-shadow: 0 -18rpx 60rpx rgba(0,0,0,.2); }
.filter-header { display: flex; min-height: 122rpx; padding: 28rpx 30rpx 22rpx 36rpx; align-items: center; justify-content: space-between; gap: 20rpx; border-bottom: var(--app-border-width) solid var(--color-border); }
.filter-header__title { display: block; color: var(--color-text); font-size: 34rpx; font-weight: 720; }
.filter-header__subtitle { display: block; margin-top: 7rpx; color: var(--color-muted); font-size: 21rpx; }
.close-button { flex: none; width: 66rpx; height: 66rpx; margin: 0; padding: 18rpx; border: 0; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); }
.filter-content { box-sizing: border-box; max-height: calc(82vh - 122rpx - 120rpx - env(safe-area-inset-bottom)); }
.filter-section { padding: 28rpx 36rpx; border-bottom: var(--app-border-width) solid var(--color-border-subtle); }
.filter-section__title { display: block; margin-bottom: 18rpx; color: var(--color-muted); font-size: 23rpx; font-weight: 620; }
.chip-list { display: flex; flex-wrap: wrap; gap: 13rpx; }
.filter-chip { min-height: 62rpx; margin: 0; padding: 0 22rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 31rpx; background: var(--color-surface); color: var(--color-muted); font-size: 24rpx; line-height: 60rpx; }
.filter-chip--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); font-weight: 620; }
.filter-section--calendar { padding-bottom: 10rpx; }
.setting-row { display: flex; min-height: 104rpx; align-items: center; gap: 24rpx; }
.setting-row--separated { border-top: var(--app-border-width) solid var(--color-border-subtle); }
.setting-row__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5rpx; }
.setting-row__label { color: var(--color-text); font-size: 26rpx; font-weight: 580; }
.setting-row__supporting { color: var(--color-muted); font-size: 20rpx; line-height: 1.4; }
.filter-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 16rpx; padding: 18rpx 30rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: var(--app-border-width) solid var(--color-border); }
.reset-button, .apply-button { height: 82rpx; margin: 0; border-radius: 18rpx; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.reset-button { border: var(--app-border-width) solid var(--color-border); background: var(--color-surface); color: var(--color-muted); }
.apply-button { border: 0; background: var(--color-accent); color: var(--color-on-accent); }
</style>
