<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, reactive, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import { PerformanceStatus } from '@/domain/performance'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import {
  copyPerformanceFields,
  createEmptyPerformanceDraft,
  performancePosterAsSelectedImage,
  PerformanceEditorService,
  type PerformanceCopyField,
  type PerformanceMediaChanges,
} from '@/features/performances/editor'
import {
  applyChineseMusicalSchedule,
  type ChineseMusicalSchedule,
  type ChineseMusicalScheduleField,
} from '@/features/performances/chinese-musical-schedule'
import ArtistPickerScreen from '@/features/performances/ArtistPickerScreen.vue'
import ChineseMusicalScheduleScreen from '@/features/performances/ChineseMusicalScheduleScreen.vue'
import CompanyPickerScreen from '@/features/performances/CompanyPickerScreen.vue'
import FriendsPickerScreen from '@/features/performances/FriendsPickerScreen.vue'
import LocationPickerScreen from '@/features/performances/LocationPickerScreen.vue'
import PurchaseChannelPickerScreen from '@/features/performances/PurchaseChannelPickerScreen.vue'
import PerformanceCopyPickerScreen from '@/features/performances/PerformanceCopyPickerScreen.vue'
import { formatSelectedLocation } from '@/features/performances/location'
import type { PerformanceDraft } from '@/features/performances/repository'
import { choosePerformanceImage } from '@/platform/media/picker'
import { createPerformanceMediaStorage } from '@/platform/media/factory'
import type { PerformanceImageRole } from '@/platform/media/types'
import { getAppRepositories } from '@/platform/repositories/context'
import { useQuickAddPreferencesStore } from '@/stores/quick-add-preferences'

interface PickerChangeEvent {
  detail: { value: string | number }
}

const props = defineProps<{
  performanceId?: string
  initialStartedAtMs?: number
}>()

const emit = defineEmits<{
  back: []
  saved: [performance: Performance]
}>()

const draft = reactive<PerformanceDraft>(createEmptyPerformanceDraft())
const categories = ref<PerformanceCategory[]>([])
const tags = ref<PerformanceTag[]>([])
const locationHistory = ref<Performance[]>([])
const loading = ref(true)
const saving = ref(false)
const locationPickerVisible = ref(false)
const playPickerVisible = ref(false)
const artistPickerVisible = ref(false)
const guestPickerVisible = ref(false)
const companyPickerVisible = ref(false)
const friendPickerVisible = ref(false)
const channelPickerVisible = ref(false)
const copyPickerVisible = ref(false)
const chineseMusicalScheduleVisible = ref(false)
const service = ref<PerformanceEditorService | null>(null)
const mediaChanges = reactive<PerformanceMediaChanges>({})
const playNames = ref<string[]>([])
const artistNames = ref<string[]>([])
const guestNames = ref<string[]>([])
const companyNames = ref<string[]>([])
const friendNames = ref<string[]>([])
const selectedChannel = ref('')
const quickAddPreferencesStore = useQuickAddPreferencesStore()
const { copyExisting, chineseMusicalSchedule } = storeToRefs(quickAddPreferencesStore)

const statusOptions = [
  { label: '正常', value: PerformanceStatus.Normal },
  { label: '待开票', value: PerformanceStatus.PendingSale },
  { label: '已取消', value: PerformanceStatus.Cancelled },
  { label: '未赴约', value: PerformanceStatus.Missed },
] as const
const currencies = ['CNY', 'USD', 'HKD', 'JPY', 'EUR'] as const

const title = computed(() => props.performanceId ? '编辑演出' : '添加演出')
const quickAddActions = computed(() => [
  ...(copyExisting.value
    ? [{ label: '复制已有演出内容', kind: 'copy' as const }]
    : []),
  ...(chineseMusicalSchedule.value
    ? [{ label: '中文音乐剧排期', kind: 'chinese-musical' as const }]
    : []),
])
const quickAddAvailable = computed(() => !props.performanceId && quickAddActions.value.length > 0)
const quickAddLabel = computed(() => {
  const labels = [
    ...(copyExisting.value ? ['复制'] : []),
    ...(chineseMusicalSchedule.value ? ['排期'] : []),
  ]
  return `${labels.join('/')}...`
})
const categoryNames = computed(() => Object.fromEntries(
  categories.value.map(({ id, name }) => [id, name]),
))
const tagNames = computed(() => Object.fromEntries(
  tags.value.map(({ id, name }) => [id, name]),
))
const saveDisabled = computed(() =>
  loading.value
  || saving.value
  || !draft.name.trim()
  || !draft.city.trim()
  || !draft.venue.trim(),
)
const locationLabel = computed(() => formatSelectedLocation(draft.city, draft.venue))
const dateValue = computed(() => formatDate(draft.startedAtMs))
const timeValue = computed(() => formatTime(draft.startedAtMs))
const categoryOptions = computed(() => [{ id: null, name: '无分类' }, ...categories.value])
const categoryIndex = computed(() => Math.max(
  0,
  categoryOptions.value.findIndex(({ id }) => id === draft.categoryId),
))
const statusIndex = computed(() => Math.max(
  0,
  statusOptions.findIndex(({ value }) => value === draft.status),
))
const performerSuggestions = computed(() => [...new Set(
  locationHistory.value.flatMap((performance) => [
    ...(performance.facets.artist ?? []),
    ...(performance.facets.guest ?? []),
  ]),
)])
const playSuggestions = computed(() => [...new Set(
  locationHistory.value.flatMap((performance) => performance.facets.play ?? []),
)])
const companySuggestions = computed(() => [...new Set(
  locationHistory.value.flatMap((performance) => performance.facets.company ?? []),
)])

onMounted(async () => {
  void quickAddPreferencesStore.initialize()
  try {
    const repositories = await getAppRepositories()
    service.value = new PerformanceEditorService(
      repositories.performances,
      createPerformanceMediaStorage(),
    )
    const [categoryItems, tagItems, performancePage] = await Promise.all([
      repositories.referenceData.listCategories(),
      repositories.referenceData.listTags(),
      repositories.performances.list({ sortDirection: 'descending', limit: 1000 }),
    ])
    categories.value = categoryItems
    tags.value = tagItems
    locationHistory.value = performancePage.items

    if (props.performanceId) {
      const performance = await repositories.performances.get(props.performanceId)
      if (!performance) throw new Error('演出记录不存在')
      assignPerformance(performance)
    } else if (props.initialStartedAtMs !== undefined) {
      draft.startedAtMs = props.initialStartedAtMs
    }
  } catch (error) {
    showError(error, '表单初始化失败')
  } finally {
    loading.value = false
  }
})

function assignPerformance(performance: Performance): void {
  Object.assign(draft, {
    ...performance,
    ticketPrice: { ...performance.ticketPrice },
    paidPrice: { ...performance.paidPrice },
    otherCost: { ...performance.otherCost },
    coordinate: performance.coordinate ? { ...performance.coordinate } : null,
    tagIds: [...performance.tagIds],
    facets: Object.fromEntries(
      Object.entries(performance.facets).map(([kind, values]) => [kind, values ? [...values] : values]),
    ),
    mediaAssets: performance.mediaAssets.map((asset) => ({ ...asset })),
  })
  synchronizeFacetEditors(performance.facets)
}

function openQuickAddMenu(): void {
  const actions = quickAddActions.value
  if (!actions.length) return
  uni.showActionSheet({
    title: '快速添加',
    itemList: actions.map(({ label }) => label),
    success: ({ tapIndex }) => {
      const action = actions[tapIndex]
      if (action?.kind === 'copy') copyPickerVisible.value = true
      if (action?.kind === 'chinese-musical') chineseMusicalScheduleVisible.value = true
    },
  })
}

function applyCopiedPerformance(payload: {
  performance: Performance
  fields: PerformanceCopyField[]
}): void {
  const copied = copyPerformanceFields(
    { ...draft, facets: collectEditorFacets() },
    payload.performance,
    payload.fields,
  )
  Object.assign(draft, copied)
  synchronizeFacetEditors(copied.facets)

  if (payload.fields.includes('poster')) {
    const poster = performancePosterAsSelectedImage(payload.performance)
    if (poster) mediaChanges.poster = poster
  }

  copyPickerVisible.value = false
  uni.showToast({ title: '已复制所选字段', icon: 'none' })
}

function applyChineseMusicalScheduleSelection(payload: {
  schedule: ChineseMusicalSchedule
  fields: ChineseMusicalScheduleField[]
}): void {
  const applied = applyChineseMusicalSchedule(
    { ...draft, facets: collectEditorFacets() },
    payload.schedule,
    payload.fields,
  )
  Object.assign(draft, applied)
  synchronizeFacetEditors(applied.facets)
  chineseMusicalScheduleVisible.value = false
  uni.showToast({ title: '已填入所选排期字段', icon: 'none' })
}

function collectEditorFacets(): Performance['facets'] {
  return {
    ...(playNames.value.length ? { play: [...playNames.value] } : {}),
    ...(artistNames.value.length ? { artist: [...artistNames.value] } : {}),
    ...(guestNames.value.length ? { guest: [...guestNames.value] } : {}),
    ...(companyNames.value.length ? { company: [...companyNames.value] } : {}),
    ...(friendNames.value.length ? { friend: [...friendNames.value] } : {}),
    ...(selectedChannel.value ? { channel: [selectedChannel.value] } : {}),
  }
}

function synchronizeFacetEditors(facets: Performance['facets']): void {
  playNames.value = [...(facets.play ?? [])]
  artistNames.value = [...(facets.artist ?? [])]
  guestNames.value = [...(facets.guest ?? [])]
  companyNames.value = [...(facets.company ?? [])]
  friendNames.value = [...(facets.friend ?? [])]
  selectedChannel.value = (facets.channel ?? []).join('、')
}

function updateDate(event: PickerChangeEvent): void {
  const [year, month, day] = String(event.detail.value).split('-').map(Number)
  const current = new Date(draft.startedAtMs)
  draft.startedAtMs = new Date(year, month - 1, day, current.getHours(), current.getMinutes()).getTime()
}

function updateTime(event: PickerChangeEvent): void {
  const [hour, minute] = String(event.detail.value).split(':').map(Number)
  const current = new Date(draft.startedAtMs)
  draft.startedAtMs = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    hour,
    minute,
  ).getTime()
}

function updateStatus(event: PickerChangeEvent): void {
  const selected = statusOptions[Number(event.detail.value)]
  if (selected) draft.status = selected.value
}

function updateCategory(event: PickerChangeEvent): void {
  draft.categoryId = categoryOptions.value[Number(event.detail.value)]?.id ?? null
}

function toggleTag(id: string): void {
  draft.tagIds = draft.tagIds.includes(id)
    ? draft.tagIds.filter((tagId) => tagId !== id)
    : [...draft.tagIds, id]
}

function applyLocation(location: { city: string; venue: string }): void {
  draft.city = location.city
  draft.venue = location.venue
  draft.coordinate = null
  locationPickerVisible.value = false
}

async function selectImage(role: PerformanceImageRole): Promise<void> {
  try {
    const selected = await choosePerformanceImage()
    if (selected) mediaChanges[role] = selected
  } catch (error) {
    showError(error, '选择图片失败')
  }
}

function removeImage(role: PerformanceImageRole): void {
  mediaChanges[role] = null
}

function mediaPreview(role: PerformanceImageRole): string {
  if (role in mediaChanges) return mediaChanges[role]?.previewPath ?? ''
  const preferredKinds = role === 'poster'
    ? ['poster_thumb', 'poster']
    : ['ticket_thumb', 'ticket_original']
  return preferredKinds
    .map((kind) => draft.mediaAssets.find((asset) => asset.kind === kind)?.relativePath)
    .find(Boolean) ?? ''
}

async function save(skipNearbyCheck = false): Promise<void> {
  if (!service.value || saving.value) return
  saving.value = true
  try {
    draft.facets = collectEditorFacets()
    const result = await service.value.save({ ...draft }, { ...mediaChanges }, skipNearbyCheck)
    if (result.kind === 'duplicate') {
      showNearbyConfirmation(result.nearby)
      return
    }

    uni.showModal({
      title: '保存成功',
      content: result.mediaCleanupFailed
        ? '演出已保存，旧图片将在后续清理。'
        : '这场演出已经记录下来。',
      showCancel: false,
      confirmText: '好的',
      success: () => emit('saved', result.performance),
    })
  } catch (error) {
    showError(error, '保存演出失败')
  } finally {
    saving.value = false
  }
}

function showNearbyConfirmation(nearby: Performance[]): void {
  const first = nearby[0]
  uni.showModal({
    title: '检测到相近时间演出',
    content: first
      ? `${formatDate(first.startedAtMs)} ${formatTime(first.startedAtMs)} 已有“${first.name}”，仍要保存吗？`
      : '相近时间已有演出，仍要保存吗？',
    cancelText: '取消保存',
    confirmText: '仍要保存',
    success: async ({ confirm }) => {
      if (confirm) await save(true)
    },
  })
}

function updateCurrency(
  target: 'ticketPrice' | 'paidPrice' | 'otherCost',
  event: PickerChangeEvent,
): void {
  const currency = currencies[Number(event.detail.value)]
  if (currency) draft[target].currency = currency
}

function currencyIndex(currency: string): number {
  return Math.max(0, currencies.indexOf(currency as typeof currencies[number]))
}

function showError(error: unknown, fallback: string): void {
  uni.showToast({
    title: error instanceof Error && error.message ? error.message : fallback,
    icon: 'none',
    duration: 2200,
  })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <view class="editor-screen">
    <AppHeader
      :title="title"
      show-back
      show-save
      :saving="saving"
      :save-disabled="saveDisabled"
      @back="$emit('back')"
      @save="save()"
    />

    <scroll-view class="editor-content" scroll-y>
      <view v-if="loading" class="loading-state">正在准备表单…</view>
      <template v-else>
        <view v-if="quickAddAvailable" class="form-section form-section--quick-add">
          <text class="form-section__title quick-add-title">⚡️快速添加（支持多方式组合使用）</text>
          <button
            class="quick-add-row"
            aria-label="打开快速添加"
            hover-class="quick-add-row--pressed"
            @tap="openQuickAddMenu"
          >
            <text>{{ quickAddLabel }}</text>
            <view class="quick-add-row__chevron"><AppIcon name="chevron" /></view>
          </button>
        </view>

        <view class="form-section">
          <text class="form-section__title">基础信息</text>
          <label class="form-field">
            <text class="form-field__label">名称 *</text>
            <input v-model="draft.name" class="form-input" aria-label="演出名称" maxlength="100" placeholder="请输入演出名称">
          </label>
          <view class="form-grid">
            <picker class="form-field" mode="date" :value="dateValue" @change="updateDate">
              <text class="form-field__label">日期 *</text>
              <view class="picker-value">{{ dateValue }}</view>
            </picker>
            <picker class="form-field" mode="time" :value="timeValue" @change="updateTime">
              <text class="form-field__label">时间 *</text>
              <view class="picker-value">{{ timeValue }}</view>
            </picker>
          </view>
          <view class="form-field form-field--spaced">
            <text class="form-field__label">场地 *</text>
            <button
              class="location-selector"
              aria-label="选择城市与场地"
              hover-class="location-selector--pressed"
              @tap="locationPickerVisible = true"
            >
              <view class="location-selector__icon"><AppIcon name="location" /></view>
              <view class="location-selector__copy">
                <text v-if="locationLabel" class="location-selector__value">{{ locationLabel }}</text>
                <text v-else class="location-selector__placeholder">选择城市与场地</text>
              </view>
              <view class="location-selector__chevron"><AppIcon name="chevron" /></view>
            </button>
          </view>
        </view>

        <view class="form-section">
          <text class="form-section__title">状态与归类</text>
          <view class="form-grid">
            <picker class="form-field" :range="statusOptions" range-key="label" :value="statusIndex" @change="updateStatus">
              <text class="form-field__label">演出状态</text>
              <view class="picker-value">{{ statusOptions[statusIndex]?.label }}</view>
            </picker>
            <picker class="form-field" :range="categoryOptions" range-key="name" :value="categoryIndex" @change="updateCategory">
              <text class="form-field__label">分类</text>
              <view class="picker-value">{{ categoryOptions[categoryIndex]?.name }}</view>
            </picker>
          </view>

          <view class="form-field form-field--block">
            <text class="form-field__label">标签</text>
            <view v-if="tags.length" class="chip-list">
              <button
                v-for="tag in tags"
                :key="tag.id"
                class="choice-chip"
                :class="{ 'choice-chip--selected': draft.tagIds.includes(tag.id) }"
                :aria-label="tag.name"
                hover-class="choice-chip--pressed"
                @tap="toggleTag(tag.id)"
              >
                {{ tag.name }}
              </button>
            </view>
            <text v-else class="form-hint form-hint--inline">请先在设置中创建标签</text>
          </view>
        </view>

        <view class="form-section">
          <text class="form-section__title">海报/票根</text>
          <view class="media-grid">
            <view v-for="role in (['poster', 'ticket'] as const)" :key="role" class="media-field">
              <text class="form-field__label">{{ role === 'poster' ? '海报' : '票根图片' }}</text>
              <button
                class="media-picker"
                hover-class="media-picker--pressed"
                @tap="selectImage(role)"
              >
                <image v-if="mediaPreview(role)" class="media-picker__image" :src="mediaPreview(role)" mode="aspectFill" />
                <view v-else class="media-picker__empty">
                  <AppIcon :name="role === 'poster' ? 'image' : 'ticket'" />
                  <text>从相册选择</text>
                </view>
              </button>
              <button v-if="mediaPreview(role)" class="media-remove" @tap="removeImage(role)">移除</button>
            </view>
          </view>
          <text class="form-hint">单张图片不超过 5 MB</text>
        </view>

        <view class="form-section">
          <text class="form-section__title">演出内容</text>
          <button
            class="name-selector"
            aria-label="选择剧目/主题"
            hover-class="name-selector--pressed"
            @tap="playPickerVisible = true"
          >
            <text class="name-selector__label">剧目/主题</text>
            <text
              class="name-selector__value"
              :class="{ 'name-selector__value--placeholder': !playNames.length }"
            >{{ playNames.length ? playNames.join('、') : '添加剧目/主题' }}</text>
            <view class="name-selector__chevron"><AppIcon name="chevron" /></view>
          </button>
          <button
            class="name-selector"
            aria-label="选择阵容"
            hover-class="name-selector--pressed"
            @tap="artistPickerVisible = true"
          >
            <text class="name-selector__label">阵容</text>
            <text
              class="name-selector__value"
              :class="{ 'name-selector__value--placeholder': !artistNames.length }"
            >{{ artistNames.length ? artistNames.join('、') : '添加阵容' }}</text>
            <view class="name-selector__chevron"><AppIcon name="chevron" /></view>
          </button>
          <button
            class="name-selector"
            aria-label="选择嘉宾"
            hover-class="name-selector--pressed"
            @tap="guestPickerVisible = true"
          >
            <text class="name-selector__label">嘉宾</text>
            <text
              class="name-selector__value"
              :class="{ 'name-selector__value--placeholder': !guestNames.length }"
            >{{ guestNames.length ? guestNames.join('、') : '添加嘉宾' }}</text>
            <view class="name-selector__chevron"><AppIcon name="chevron" /></view>
          </button>
          <button
            class="name-selector"
            aria-label="选择同行好友"
            hover-class="name-selector--pressed"
            @tap="friendPickerVisible = true"
          >
            <text class="name-selector__label">同行好友</text>
            <text
              class="name-selector__value"
              :class="{ 'name-selector__value--placeholder': !friendNames.length }"
            >{{ friendNames.length ? friendNames.join('、') : '添加同行好友' }}</text>
            <view class="name-selector__chevron"><AppIcon name="chevron" /></view>
          </button>

          <button
            class="name-selector"
            aria-label="选择厂牌"
            hover-class="name-selector--pressed"
            @tap="companyPickerVisible = true"
          >
            <text class="name-selector__label">厂牌</text>
            <text
              class="name-selector__value"
              :class="{ 'name-selector__value--placeholder': !companyNames.length }"
            >{{ companyNames.length ? companyNames.join('、') : '添加厂牌' }}</text>
            <view class="name-selector__chevron"><AppIcon name="chevron" /></view>
          </button>

          <label class="form-field form-field--spaced">
            <text class="form-field__label">座位号</text>
            <input v-model="draft.seat" class="form-input" aria-label="座位号" maxlength="80" placeholder="例如：A 区 8 排 12 座">
          </label>

          <view class="form-field form-field--spaced">
            <text class="form-field__label">我的评分</text>
            <view class="rating-row">
              <button
                v-for="score in 5"
                :key="score"
                class="rating-button"
                :class="{ 'rating-button--active': score <= draft.rating }"
                :aria-label="`${score} 星`"
                @tap="draft.rating = draft.rating === score ? 0 : score"
              >★</button>
            </view>
          </view>

          <label class="form-field form-field--spaced">
            <text class="form-field__label">备注</text>
            <textarea v-model="draft.remark" class="form-textarea" aria-label="备注" maxlength="1000" placeholder="记录值得记住的细节" />
          </label>
        </view>

        <view class="form-section">
          <text class="form-section__title">花费</text>
          <button
            class="name-selector cost-channel-selector"
            aria-label="选择购票渠道"
            hover-class="name-selector--pressed"
            @tap="channelPickerVisible = true"
          >
            <text class="name-selector__label">购票渠道</text>
            <text
              class="name-selector__value"
              :class="{ 'name-selector__value--placeholder': !selectedChannel }"
            >{{ selectedChannel || '选择购票渠道' }}</text>
            <view class="name-selector__chevron"><AppIcon name="chevron" /></view>
          </button>
          <view v-for="cost in ([
            ['ticketPrice', '票面价'],
            ['paidPrice', '实付价'],
            ['otherCost', '其他花费'],
          ] as const)" :key="cost[0]" class="money-row">
            <text class="money-row__label">{{ cost[1] }}</text>
            <picker :range="currencies" :value="currencyIndex(draft[cost[0]].currency)" @change="updateCurrency(cost[0], $event)">
              <view class="currency-picker">{{ draft[cost[0]].currency }}</view>
            </picker>
            <input v-model="draft[cost[0]].amount" class="money-input" type="digit" placeholder="0.00">
          </view>
        </view>

        <button class="primary-save" :disabled="saveDisabled" hover-class="primary-save--pressed" @tap="save()">
          {{ saving ? '正在保存…' : '保存演出' }}
        </button>
      </template>
    </scroll-view>

    <LocationPickerScreen
      :visible="locationPickerVisible"
      :city="draft.city"
      :venue="draft.venue"
      :performances="locationHistory"
      @close="locationPickerVisible = false"
      @confirm="applyLocation"
    />
    <ArtistPickerScreen
      v-model:values="playNames"
      kind="play"
      :visible="playPickerVisible"
      :suggestions="playSuggestions"
      @close="playPickerVisible = false"
    />
    <ArtistPickerScreen
      v-model:values="artistNames"
      kind="artist"
      :visible="artistPickerVisible"
      :suggestions="performerSuggestions"
      @close="artistPickerVisible = false"
    />
    <ArtistPickerScreen
      v-model:values="guestNames"
      kind="guest"
      :visible="guestPickerVisible"
      :suggestions="performerSuggestions"
      @close="guestPickerVisible = false"
    />
    <PurchaseChannelPickerScreen
      v-model:value="selectedChannel"
      :visible="channelPickerVisible"
      @close="channelPickerVisible = false"
    />
    <FriendsPickerScreen
      v-model:values="friendNames"
      :visible="friendPickerVisible"
      @close="friendPickerVisible = false"
    />
    <CompanyPickerScreen
      v-model:values="companyNames"
      :visible="companyPickerVisible"
      :suggestions="companySuggestions"
      @close="companyPickerVisible = false"
    />
    <PerformanceCopyPickerScreen
      :visible="copyPickerVisible"
      :performances="locationHistory"
      :category-names="categoryNames"
      :tag-names="tagNames"
      @close="copyPickerVisible = false"
      @apply="applyCopiedPerformance"
    />
    <ChineseMusicalScheduleScreen
      :visible="chineseMusicalScheduleVisible"
      :initial-started-at-ms="draft.startedAtMs"
      @close="chineseMusicalScheduleVisible = false"
      @apply="applyChineseMusicalScheduleSelection"
    />
  </view>
</template>

<style scoped>
.editor-screen { min-height: 100vh; background: var(--color-background); }
.editor-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding-bottom: calc(64rpx + env(safe-area-inset-bottom)); }
.loading-state { padding: 100rpx 40rpx; color: var(--color-muted); text-align: center; }
.form-section { padding: 42rpx 34rpx; border-bottom: var(--app-border-width) solid var(--color-border); }
.form-section__title { display: block; margin-bottom: 26rpx; color: var(--color-accent); font-size: 28rpx; font-weight: 650; }
.form-section--quick-add { padding-top: 28rpx; padding-bottom: 28rpx; }
.quick-add-title { margin-bottom: 14rpx; font-size: 22rpx; font-weight: 550; }
.quick-add-row { box-sizing: border-box; display: flex; width: 100%; min-height: 82rpx; margin: 0; padding: 0 18rpx; align-items: center; justify-content: space-between; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); color: var(--color-text); font-size: 27rpx; font-weight: 600; text-align: left; }
.quick-add-row--pressed { background: var(--color-row-pressed); }
.quick-add-row__chevron { width: 28rpx; height: 28rpx; flex: none; color: var(--color-muted); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; margin-top: 20rpx; }
.form-field { display: block; min-width: 0; }
.form-field--block, .form-field--spaced { margin-top: 24rpx; }
.form-field__label { display: block; margin-bottom: 12rpx; color: var(--color-muted); font-size: 24rpx; font-weight: 550; }
.form-input, .form-textarea, .picker-value { box-sizing: border-box; width: 100%; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); color: var(--color-text); font-size: 28rpx; }
.form-input, .picker-value { height: 82rpx; padding: 0 22rpx; line-height: 82rpx; }
.form-textarea { height: 180rpx; padding: 20rpx 22rpx; line-height: 1.55; }
.form-hint { display: block; margin-top: 14rpx; color: var(--color-muted); font-size: 22rpx; line-height: 1.5; }
.form-hint--inline { margin-top: 4rpx; }
.chip-list { display: flex; flex-wrap: wrap; gap: 14rpx; }
.choice-chip { min-height: 64rpx; margin: 0; padding: 0 24rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 32rpx; background: var(--color-surface); color: var(--color-muted); font-size: 25rpx; line-height: 62rpx; }
.choice-chip::after, .media-picker::after, .media-remove::after, .rating-button::after, .primary-save::after, .location-selector::after, .name-selector::after, .quick-add-row::after { border: 0; }
.choice-chip--selected { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent); }
.choice-chip--pressed { opacity: 0.7; }
.media-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22rpx; }
.media-picker { display: block; width: 100%; height: auto; aspect-ratio: 3 / 4; margin: 0; padding: 0; overflow: hidden; border: var(--app-border-width) dashed var(--color-border); border-radius: 20rpx; background: var(--color-surface); color: var(--color-accent); }
.media-picker--pressed { opacity: 0.75; }
.media-picker__image { width: 100%; height: 100%; object-position: center; }
.media-picker__empty { display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 16rpx; color: var(--color-muted); font-size: 24rpx; }
.media-picker__empty > :first-child { width: 52rpx; height: 52rpx; color: var(--color-accent); }
.media-remove { height: 60rpx; margin: 8rpx 0 0; padding: 0; border: 0; background: transparent; color: #b43b32; font-size: 24rpx; line-height: 60rpx; }
.rating-row { display: flex; gap: 8rpx; }
.rating-button { width: 62rpx; height: 62rpx; margin: 0; padding: 0; border: 0; background: transparent; color: var(--color-border); font-size: 45rpx; line-height: 62rpx; }
.rating-button--active { color: var(--color-accent); }
.money-row { display: grid; grid-template-columns: 150rpx 112rpx minmax(0, 1fr); min-height: 94rpx; align-items: center; border-bottom: var(--app-border-width) solid var(--color-border-subtle); }
.money-row:last-child { border-bottom: 0; }
.money-row__label { color: var(--color-text); font-size: 28rpx; }
.currency-picker { color: var(--color-accent); font-size: 25rpx; text-align: center; }
.money-input { height: 72rpx; color: var(--color-text); font-size: 29rpx; text-align: right; }
.primary-save { height: 92rpx; margin: 44rpx 34rpx 20rpx; border: 0; border-radius: 20rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 30rpx; font-weight: 650; line-height: 92rpx; }
.primary-save--pressed { background: var(--color-accent-pressed); }
.primary-save[disabled] { background: var(--color-border); color: var(--color-muted); opacity: 0.7; }
.location-selector { box-sizing: border-box; display: flex; width: 100%; min-height: 100rpx; margin: 0; padding: 17rpx 20rpx; align-items: center; gap: 16rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 17rpx; background: var(--color-surface); color: var(--color-text); text-align: left; }
.location-selector--pressed { background: var(--color-row-pressed); }
.location-selector__icon { width: 40rpx; height: 40rpx; flex: none; color: var(--color-accent); }
.location-selector__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.location-selector__value, .location-selector__placeholder { overflow: hidden; font-size: 27rpx; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.location-selector__value { color: var(--color-text); }
.location-selector__placeholder { color: var(--color-accent); }
.location-selector__chevron { width: 30rpx; height: 30rpx; flex: none; color: var(--color-muted); }
.name-selector { box-sizing: border-box; display: flex; width: 100%; min-height: 84rpx; margin: 0; padding: 0; align-items: center; gap: 14rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.name-selector--pressed { background: var(--color-row-pressed); }
.name-selector__label { min-width: 150rpx; flex: none; color: var(--color-text); font-size: 27rpx; line-height: 1.35; white-space: nowrap; }
.name-selector__value { min-width: 0; flex: 1; overflow: hidden; color: var(--color-accent); font-size: 26rpx; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.name-selector__value--placeholder { font-weight: 620; }
.name-selector__chevron { width: 28rpx; height: 28rpx; flex: none; color: var(--color-muted); }
.cost-channel-selector { margin-bottom: 4rpx; }
</style>
