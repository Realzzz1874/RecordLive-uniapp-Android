<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import {
  PERFORMANCE_COPY_FIELDS,
  type PerformanceCopyField,
} from '@/features/performances/editor'

interface CopyFieldOption {
  key: PerformanceCopyField
  label: string
  value: string
}

const props = defineProps<{
  visible: boolean
  performances: readonly Performance[]
  categoryNames?: Readonly<Record<string, string>>
  tagNames?: Readonly<Record<string, string>>
}>()

const emit = defineEmits<{
  close: []
  apply: [payload: { performance: Performance; fields: PerformanceCopyField[] }]
}>()

const searchText = ref('')
const selectedPerformance = ref<Performance | null>(null)
const selectedFields = ref<PerformanceCopyField[]>([])

const filteredPerformances = computed(() => {
  const keyword = searchText.value.trim().toLocaleLowerCase()
  return props.performances
    .filter((performance) => {
      if (!keyword) return true
      return [
        performance.name,
        ...(performance.facets.artist ?? []),
      ].some((value) => value.toLocaleLowerCase().includes(keyword))
    })
    .slice(0, 50)
})

const copyFieldOptions = computed<CopyFieldOption[]>(() => {
  const performance = selectedPerformance.value
  if (!performance) return []

  const options: Array<CopyFieldOption | null> = [
    hasPoster(performance) ? option('poster', '海报', '复制海报') : null,
    option('name', '名称', performance.name),
    option('date', '时间', formatDateTime(performance.startedAtMs)),
    option('city', '城市', performance.city),
    option('venue', '场地', performance.venue),
    performance.remark.trim() ? option('remark', '备注', performance.remark) : null,
    option('ticketPrice', '票面价', formatMoney(performance.ticketPrice)),
    option('paidPrice', '实付价', formatMoney(performance.paidPrice)),
    facetOption(performance, 'artist', '阵容'),
    facetOption(performance, 'play', '剧目/主题'),
    performance.seat.trim() ? option('seat', '座位', performance.seat) : null,
    performance.rating > 0 ? option('rating', '评分', `${performance.rating} 星`) : null,
    facetOption(performance, 'guest', '嘉宾'),
    performance.categoryId
      ? option('category', '分类', props.categoryNames?.[performance.categoryId] ?? '已选分类')
      : null,
    performance.tagIds.length
      ? option('tags', '标签', performance.tagIds.map((id) => props.tagNames?.[id] ?? id).join('、'))
      : null,
    facetOption(performance, 'channel', '购票渠道'),
    facetOption(performance, 'friend', '同行好友'),
    facetOption(performance, 'company', '厂牌'),
  ]
  return options.filter((item): item is CopyFieldOption => item !== null)
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  searchText.value = ''
  closeFieldSelection()
})

function choosePerformance(performance: Performance): void {
  selectedPerformance.value = performance
  selectedFields.value = copyFieldOptions.value.map(({ key }) => key)
}

function toggleField(field: PerformanceCopyField): void {
  selectedFields.value = selectedFields.value.includes(field)
    ? selectedFields.value.filter((item) => item !== field)
    : PERFORMANCE_COPY_FIELDS.filter((item) => item === field || selectedFields.value.includes(item))
}

function closeFieldSelection(): void {
  selectedPerformance.value = null
  selectedFields.value = []
}

function applySelection(): void {
  if (!selectedPerformance.value) return
  emit('apply', {
    performance: selectedPerformance.value,
    fields: [...selectedFields.value],
  })
  closeFieldSelection()
}

function option(key: PerformanceCopyField, label: string, value: string): CopyFieldOption {
  return { key, label, value }
}

function facetOption(
  performance: Performance,
  kind: keyof Performance['facets'],
  label: string,
): CopyFieldOption | null {
  const values = performance.facets[kind]
  return values?.length ? option(kind as PerformanceCopyField, label, values.join('、')) : null
}

function hasPoster(performance: Performance): boolean {
  return performance.mediaAssets.some(({ kind, relativePath }) =>
    (kind === 'poster' || kind === 'poster_thumb') && Boolean(relativePath),
  )
}

function formatMoney(value: Performance['ticketPrice']): string {
  return `${value.currency} ${value.amount}`
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <view v-if="visible" class="copy-picker-screen">
    <AppHeader
      title="复制已有演出"
      show-back
      back-icon="close"
      back-label="关闭复制已有演出"
      @back="$emit('close')"
    />

    <view class="copy-search">
      <view class="copy-search__icon"><AppIcon name="search" /></view>
      <input
        v-model="searchText"
        aria-label="搜索已有演出"
        confirm-type="search"
        placeholder="搜索演出名称或阵容"
      >
    </view>

    <scroll-view class="copy-list" scroll-y>
      <text v-if="filteredPerformances.length === 50" class="copy-list__hint">最新 50 场，可搜索更多</text>
      <button
        v-for="performance in filteredPerformances"
        :key="performance.id"
        class="copy-row"
        :aria-label="`选择已有演出${performance.name}`"
        hover-class="copy-row--pressed"
        @tap="choosePerformance(performance)"
      >
        <view class="copy-row__main">
          <text class="copy-row__date">{{ formatDateTime(performance.startedAtMs).slice(0, 10) }}</text>
          <text class="copy-row__name">{{ performance.name }}</text>
        </view>
        <text class="copy-row__artists">{{ (performance.facets.artist ?? []).join('、') || `${performance.city} · ${performance.venue}` }}</text>
        <view class="copy-row__chevron"><AppIcon name="chevron" /></view>
      </button>
      <text v-if="!filteredPerformances.length" class="copy-empty">
        {{ performances.length ? '没有找到匹配的演出' : '还没有可复制的演出' }}
      </text>
    </scroll-view>

    <view v-if="selectedPerformance" class="field-layer">
      <button class="field-scrim" aria-label="取消选择复制字段" @tap="closeFieldSelection" />
      <view class="field-dialog" aria-label="选择需要复制的字段">
        <text class="field-dialog__title">勾选所需字段</text>
        <text class="field-dialog__source">{{ selectedPerformance.name }}</text>
        <scroll-view class="field-list" scroll-y>
          <button
            v-for="field in copyFieldOptions"
            :key="field.key"
            class="field-row"
            :aria-label="`${selectedFields.includes(field.key) ? '取消复制' : '复制'}${field.label}`"
            @tap="toggleField(field.key)"
          >
            <view class="field-check" :class="{ 'field-check--selected': selectedFields.includes(field.key) }">
              <AppIcon v-if="selectedFields.includes(field.key)" name="check" />
            </view>
            <text class="field-row__label">{{ field.label }}</text>
            <text class="field-row__value">{{ field.value }}</text>
          </button>
        </scroll-view>
        <view class="field-actions">
          <button @tap="closeFieldSelection">取消</button>
          <button aria-label="确认复制所选字段" @tap="applySelection">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.copy-picker-screen { position: fixed; z-index: 82; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.copy-search { display: flex; height: 76rpx; margin: 22rpx 28rpx 18rpx; padding: 0 18rpx; align-items: center; gap: 13rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 17rpx; background: var(--color-surface); }
.copy-search__icon { width: 31rpx; height: 31rpx; flex: none; color: var(--color-muted); }
.copy-search input { min-width: 0; height: 76rpx; flex: 1; color: var(--color-text); font-size: 26rpx; }
.copy-list { box-sizing: border-box; height: calc(100vh - var(--app-header-height) - 116rpx); padding: 0 28rpx calc(50rpx + env(safe-area-inset-bottom)); }
.copy-list__hint { display: block; padding: 8rpx 10rpx 15rpx; color: var(--color-muted); font-size: 21rpx; }
.copy-row { position: relative; display: flex; width: 100%; min-height: 104rpx; margin: 0; padding: 17rpx 46rpx 17rpx 17rpx; flex-direction: column; justify-content: center; gap: 8rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.copy-row::after, .field-scrim::after, .field-row::after, .field-actions button::after { border: 0; }
.copy-row--pressed { background: var(--color-row-pressed); }
.copy-row__main { display: flex; min-width: 0; align-items: center; gap: 14rpx; }
.copy-row__date { flex: none; color: var(--color-accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.copy-row__name { min-width: 0; overflow: hidden; flex: 1; font-size: 27rpx; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.copy-row__artists { overflow: hidden; color: var(--color-muted); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.copy-row__chevron { position: absolute; top: 37rpx; right: 12rpx; width: 26rpx; height: 26rpx; color: var(--color-muted); }
.copy-empty { display: block; padding: 100rpx 24rpx; color: var(--color-muted); font-size: 24rpx; text-align: center; }
.field-layer { position: absolute; z-index: 3; inset: 0; display: flex; padding: 32rpx; align-items: center; justify-content: center; }
.field-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15, 10, 8, .5); }
.field-dialog { position: relative; z-index: 1; box-sizing: border-box; display: flex; width: 100%; max-height: 82vh; padding: 30rpx; flex-direction: column; border-radius: 24rpx; background: var(--color-surface); box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, .22); }
.field-dialog__title { font-size: 30rpx; font-weight: 700; text-align: center; }
.field-dialog__source { margin: 8rpx 0 20rpx; overflow: hidden; color: var(--color-muted); font-size: 22rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.field-list { min-height: 180rpx; max-height: 58vh; border-top: var(--app-border-width) solid var(--color-border-subtle); border-bottom: var(--app-border-width) solid var(--color-border-subtle); }
.field-row { display: flex; width: 100%; min-height: 78rpx; margin: 0; padding: 10rpx 4rpx; align-items: center; gap: 12rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.field-check { box-sizing: border-box; width: 34rpx; height: 34rpx; padding: 4rpx; flex: none; border: var(--app-border-width) solid var(--color-border); border-radius: 7rpx; color: transparent; }
.field-check--selected { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-on-accent); }
.field-row__label { width: 112rpx; flex: none; color: var(--color-text); font-size: 24rpx; }
.field-row__value { min-width: 0; overflow: hidden; flex: 1; color: var(--color-muted); font-size: 23rpx; text-overflow: ellipsis; white-space: nowrap; }
.field-actions { display: grid; margin-top: 24rpx; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.field-actions button { height: 72rpx; margin: 0; border: 0; border-radius: 15rpx; background: var(--color-row-pressed); color: var(--color-muted); font-size: 25rpx; line-height: 72rpx; }
.field-actions button:last-child { background: var(--color-accent); color: var(--color-on-accent); }
</style>
