<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance, PerformanceFacetKind } from '@/domain/performance'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import {
  formatPerformanceDate,
  formatPerformanceLocation,
  PerformanceBrowserService,
  performanceLifecycleLabel,
  performanceMediaPath,
} from '@/features/performances/browser'
import { createPerformanceMediaStorage } from '@/platform/media/factory'
import { getAppRepositories } from '@/platform/repositories/context'

const props = defineProps<{
  performanceId: string
}>()

const emit = defineEmits<{
  back: []
  edit: [id: string]
  deleted: [id: string]
}>()

const performance = ref<Performance | null>(null)
const categories = ref<PerformanceCategory[]>([])
const tags = ref<PerformanceTag[]>([])
const loading = ref(true)
const deleting = ref(false)
const browserService = ref<PerformanceBrowserService | null>(null)

const categoryName = computed(() => categories.value.find(
  ({ id }) => id === performance.value?.categoryId,
)?.name ?? '')
const tagNames = computed(() => {
  const ids = new Set(performance.value?.tagIds ?? [])
  return tags.value.filter(({ id }) => ids.has(id)).map(({ name }) => name)
})
const detailRows = computed(() => {
  const item = performance.value
  if (!item) return []
  return [
    { icon: 'calendar' as const, label: '演出时间', value: formatPerformanceDate(item.startedAtMs, true) },
    { icon: 'location' as const, label: '城市与场馆', value: formatPerformanceLocation(item) },
    { icon: 'seat' as const, label: '座位', value: item.seat },
  ].filter(({ value }) => value)
})
const facetSections: readonly { kind: PerformanceFacetKind; label: string }[] = [
  { kind: 'artist', label: '阵容' },
  { kind: 'guest', label: '嘉宾' },
  { kind: 'play', label: '剧目/主题' },
  { kind: 'company', label: '出品方' },
  { kind: 'channel', label: '购票渠道' },
  { kind: 'friend', label: '同行好友' },
]
const visibleFacets = computed(() => facetSections.filter(
  ({ kind }) => Boolean(performance.value?.facets[kind]?.length),
))
const costs = computed(() => {
  const item = performance.value
  if (!item) return []
  return [
    { label: '票面价', value: formatMoney(item.ticketPrice.amount, item.ticketPrice.currency) },
    { label: '实付价', value: formatMoney(item.paidPrice.amount, item.paidPrice.currency) },
    { label: '其他花费', value: formatMoney(item.otherCost.amount, item.otherCost.currency) },
  ].filter(({ value }) => value)
})

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    browserService.value = new PerformanceBrowserService(
      repositories.performances,
      createPerformanceMediaStorage(),
    )
    const [item, categoryItems, tagItems] = await Promise.all([
      repositories.performances.get(props.performanceId),
      repositories.referenceData.listCategories(),
      repositories.referenceData.listTags(),
    ])
    if (!item) throw new Error('演出记录不存在')
    performance.value = item
    categories.value = categoryItems
    tags.value = tagItems
  } catch (error) {
    uni.showModal({
      title: '无法打开演出',
      content: error instanceof Error ? error.message : '读取演出详情失败',
      showCancel: false,
      confirmText: '返回',
      success: () => emit('back'),
    })
  } finally {
    loading.value = false
  }
}

function confirmDelete(): void {
  if (!performance.value || deleting.value) return
  uni.showModal({
    title: '删除这场演出？',
    content: `“${performance.value.name}”删除后无法恢复。`,
    cancelText: '取消',
    confirmText: '删除',
    confirmColor: '#b5473e',
    success: ({ confirm }) => {
      if (confirm) void removePerformance()
    },
  })
}

async function removePerformance(): Promise<void> {
  if (!browserService.value || !performance.value) return
  deleting.value = true
  try {
    const id = performance.value.id
    const result = await browserService.value.remove(id)
    if (result.mediaCleanupFailed) {
      uni.showToast({ title: '演出已删除，图片将在后续清理', icon: 'none' })
    } else {
      uni.showToast({ title: '演出已删除', icon: 'success' })
    }
    emit('deleted', id)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '删除演出失败',
      icon: 'none',
    })
  } finally {
    deleting.value = false
  }
}

function formatMoney(amount: string, currency: string): string {
  const value = amount.trim()
  if (!value || Number(value) === 0) return ''
  return `${value} ${currency}`
}
</script>

<template>
  <view class="detail-screen">
    <AppHeader
      :title="performance?.name ?? '演出详情'"
      show-back
      show-edit
      show-delete
      @back="$emit('back')"
      @edit="performance && $emit('edit', performance.id)"
      @delete="confirmDelete"
    />

    <view v-if="loading" class="loading-state">正在读取演出详情…</view>
    <scroll-view v-else-if="performance" class="detail-content" scroll-y>
      <view v-if="performanceMediaPath(performance, 'poster')" class="hero">
        <image class="hero__image" :src="performanceMediaPath(performance, 'poster')" mode="widthFix" />
        <view class="hero__shade" />
        <view class="hero__copy">
          <text class="hero__status">{{ performanceLifecycleLabel(performance) }}</text>
          <text class="hero__title">{{ performance.name }}</text>
          <text class="hero__location">{{ formatPerformanceLocation(performance) }}</text>
        </view>
      </view>
      <view v-else class="title-block">
        <text class="title-block__status">{{ performanceLifecycleLabel(performance) }}</text>
        <text class="title-block__title">{{ performance.name }}</text>
        <text class="title-block__date">{{ formatPerformanceDate(performance.startedAtMs, true) }}</text>
      </view>

      <view class="detail-section detail-section--facts">
        <view v-for="row in detailRows" :key="row.label" class="fact-row">
          <view class="fact-row__icon"><AppIcon :name="row.icon" /></view>
          <view class="fact-row__content">
            <text class="fact-row__label">{{ row.label }}</text>
            <text class="fact-row__value">{{ row.value }}</text>
          </view>
        </view>
        <view v-if="categoryName" class="fact-row">
          <view class="fact-row__icon"><AppIcon name="folder" /></view>
          <view class="fact-row__content">
            <text class="fact-row__label">分类</text>
            <text class="fact-row__value">{{ categoryName }}</text>
          </view>
        </view>
        <view v-if="performance.rating > 0" class="fact-row">
          <view class="fact-row__icon"><AppIcon name="award" /></view>
          <view class="fact-row__content">
            <text class="fact-row__label">我的评分</text>
            <text class="rating">{{ '★'.repeat(Math.round(performance.rating)) }}<text class="rating__value"> {{ performance.rating }}/5</text></text>
          </view>
        </view>
      </view>

      <view v-if="tagNames.length" class="detail-section">
        <text class="section-title">标签</text>
        <view class="tag-list"><text v-for="tag in tagNames" :key="tag" class="tag-pill"># {{ tag }}</text></view>
      </view>

      <view v-if="visibleFacets.length" class="detail-section">
        <text class="section-title">演出内容</text>
        <view v-for="facet in visibleFacets" :key="facet.kind" class="text-row">
          <text class="text-row__label">{{ facet.label }}</text>
          <text class="text-row__value">{{ performance.facets[facet.kind]?.join('、') }}</text>
        </view>
      </view>

      <view v-if="costs.length" class="detail-section">
        <text class="section-title">花费</text>
        <view v-for="cost in costs" :key="cost.label" class="text-row">
          <text class="text-row__label">{{ cost.label }}</text>
          <text class="text-row__value text-row__value--money">{{ cost.value }}</text>
        </view>
      </view>

      <view v-if="performance.remark" class="detail-section">
        <text class="section-title">备注</text>
        <text class="remark">{{ performance.remark }}</text>
      </view>

      <view v-if="performanceMediaPath(performance, 'ticket')" class="detail-section">
        <text class="section-title">票根</text>
        <image class="ticket-image" :src="performanceMediaPath(performance, 'ticket')" mode="widthFix" />
      </view>

      <button class="edit-button" hover-class="edit-button--pressed" @tap="$emit('edit', performance.id)">
        <AppIcon name="edit" />
        <text>编辑演出</text>
      </button>
    </scroll-view>
  </view>
</template>

<style scoped>
.detail-screen { min-height: 100vh; background: var(--color-background); }
.loading-state { display: flex; min-height: calc(100vh - var(--app-header-height)); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.detail-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding-bottom: calc(64rpx + env(safe-area-inset-bottom)); }
.hero { position: relative; width: 100%; overflow: hidden; background: var(--color-accent-soft); }
.hero__image { display: block; width: 100%; height: auto; }
.hero__shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 38%, rgba(20, 14, 11, 0.88)); }
.hero__copy { position: absolute; right: 36rpx; bottom: 38rpx; left: 36rpx; display: flex; flex-direction: column; align-items: flex-start; }
.hero__status, .title-block__status { padding: 7rpx 16rpx; border-radius: 20rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 21rpx; }
.hero__title { margin-top: 18rpx; color: #fff; font-size: 42rpx; font-weight: 750; line-height: 1.25; }
.hero__location { margin-top: 10rpx; color: rgba(255,255,255,.78); font-size: 25rpx; }
.title-block { display: flex; padding: 48rpx 36rpx 42rpx; flex-direction: column; align-items: flex-start; border-bottom: 1rpx solid var(--color-border); }
.title-block__title { margin-top: 20rpx; color: var(--color-text); font-size: 42rpx; font-weight: 750; line-height: 1.3; }
.title-block__date { margin-top: 13rpx; color: var(--color-muted); font-size: 26rpx; }
.detail-section { padding: 36rpx; border-bottom: 1rpx solid var(--color-border); }
.detail-section--facts { padding-top: 20rpx; padding-bottom: 20rpx; }
.fact-row { display: flex; min-height: 104rpx; align-items: center; gap: 22rpx; }
.fact-row__icon { width: 42rpx; height: 42rpx; flex: none; color: var(--color-accent); }
.fact-row__content { display: flex; min-width: 0; flex-direction: column; gap: 6rpx; }
.fact-row__label, .text-row__label { color: var(--color-muted); font-size: 22rpx; }
.fact-row__value { color: var(--color-text); font-size: 28rpx; line-height: 1.4; }
.rating { color: var(--color-accent); font-size: 28rpx; letter-spacing: 2rpx; }
.rating__value { color: var(--color-muted); font-size: 22rpx; letter-spacing: 0; }
.section-title { display: block; margin-bottom: 24rpx; color: var(--color-accent); font-size: 27rpx; font-weight: 680; }
.tag-list { display: flex; flex-wrap: wrap; gap: 12rpx; }
.tag-pill { padding: 9rpx 18rpx; border-radius: 24rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 23rpx; }
.text-row { display: grid; grid-template-columns: 150rpx minmax(0, 1fr); gap: 18rpx; padding: 16rpx 0; }
.text-row__label { padding-top: 3rpx; }
.text-row__value { color: var(--color-text); font-size: 27rpx; line-height: 1.5; }
.text-row__value--money { color: var(--color-accent); font-weight: 650; }
.remark { color: var(--color-text); font-size: 27rpx; line-height: 1.75; white-space: pre-wrap; }
.ticket-image { width: 100%; overflow: hidden; border-radius: 18rpx; background: var(--color-accent-soft); }
.edit-button { display: flex; height: 92rpx; margin: 42rpx 36rpx 20rpx; align-items: center; justify-content: center; gap: 14rpx; border: 1rpx solid var(--color-accent); border-radius: 20rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 28rpx; font-weight: 650; line-height: 92rpx; }
.edit-button::after { border: 0; }
.edit-button > :first-child { width: 34rpx; height: 34rpx; }
.edit-button--pressed { background: var(--color-row-pressed); }
</style>
