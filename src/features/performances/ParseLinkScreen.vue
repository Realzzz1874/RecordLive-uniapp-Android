<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  availableParseLinkFields,
  extractFirstHttpUrl,
  formatParsedDate,
  type ParseLinkField,
} from '@/features/performances/parse-link'
import { downloadParsePlatformImage, platformAssetUrl } from '@/features/performances/parse-platform/networking'
import {
  createParsePlatformRouter,
  SUPPORTED_PARSE_PLATFORM_NAMES,
} from '@/features/performances/parse-platform/registry'
import { ParsePlatformError, type ParsePlatformResult } from '@/features/performances/parse-platform/types'
import type { SelectedImage } from '@/platform/media/types'

type ParseStatus = 'idle' | 'loading' | 'ready' | 'error'

interface FieldOption {
  key: ParseLinkField
  label: string
  value: string
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [payload: {
    result: ParsePlatformResult
    fields: ParseLinkField[]
    poster: SelectedImage | null
  }]
}>()

const router = createParsePlatformRouter()
const input = ref('')
const status = ref<ParseStatus>('idle')
const errorMessage = ref('')
const parsedResult = ref<ParsePlatformResult | null>(null)
const selectionVisible = ref(false)
const selectedFields = ref<ParseLinkField[]>([])
const downloadedPoster = ref<SelectedImage | null>(null)
const preparingSelection = ref(false)
let requestVersion = 0

const previewPosterUrl = computed(() => {
  const value = parsedResult.value?.coverUrl ?? ''
  return value ? platformAssetUrl(value) : ''
})
const fieldOptions = computed<FieldOption[]>(() => {
  const result = parsedResult.value
  if (!result) return []
  const options: FieldOption[] = []
  for (const key of availableParseLinkFields(result)) {
    if (key === 'poster') {
      if (downloadedPoster.value) options.push({ key, label: '海报', value: '已获取海报' })
      continue
    }
    if (key === 'name') options.push({ key, label: '名称', value: result.name })
    if (key === 'play') options.push({ key, label: '主题', value: displayPlay(result.play) })
    if (key === 'date') options.push({ key, label: '时间', value: formatParsedDate(result.startedAtMs) })
    if (key === 'city') options.push({ key, label: '城市', value: result.city })
    if (key === 'venue') options.push({ key, label: '场地', value: result.venue })
    if (key === 'artist') options.push({ key, label: '阵容', value: result.artistNames.join('、') })
  }
  return options
})

watch(() => props.visible, (visible) => {
  requestVersion += 1
  if (visible) resetScreen()
})

function resetScreen(): void {
  input.value = ''
  status.value = 'idle'
  errorMessage.value = ''
  parsedResult.value = null
  selectionVisible.value = false
  selectedFields.value = []
  downloadedPoster.value = null
  preparingSelection.value = false
}

async function startParsing(): Promise<void> {
  const url = extractFirstHttpUrl(input.value)
  if (!url) {
    status.value = 'error'
    errorMessage.value = '链接格式错误'
    parsedResult.value = null
    return
  }

  const version = ++requestVersion
  status.value = 'loading'
  errorMessage.value = ''
  parsedResult.value = null
  selectionVisible.value = false
  downloadedPoster.value = null
  try {
    const result = await router.parse(url)
    if (version !== requestVersion) return
    parsedResult.value = result
    status.value = 'ready'
  } catch (error) {
    if (version !== requestVersion) return
    status.value = 'error'
    errorMessage.value = parseErrorText(error)
  }
}

async function prepareSelection(): Promise<void> {
  const result = parsedResult.value
  if (!result || preparingSelection.value) return
  preparingSelection.value = true
  try {
    downloadedPoster.value = result.coverUrl
      ? await downloadParsePlatformImage(result.coverUrl)
      : null
    selectedFields.value = fieldOptions.value.map(({ key }) => key)
    selectionVisible.value = true
  } finally {
    preparingSelection.value = false
  }
}

function toggleField(field: ParseLinkField): void {
  selectedFields.value = selectedFields.value.includes(field)
    ? selectedFields.value.filter((item) => item !== field)
    : availableParseLinkFields(parsedResult.value as ParsePlatformResult).filter(
        (item) => item === field || selectedFields.value.includes(item),
      )
}

function closeSelection(): void {
  selectionVisible.value = false
  selectedFields.value = []
}

function confirmSelection(): void {
  const result = parsedResult.value
  if (!result) return
  emit('apply', {
    result,
    fields: [...selectedFields.value],
    poster: selectedFields.value.includes('poster') ? downloadedPoster.value : null,
  })
  closeSelection()
}

function parseErrorText(error: unknown): string {
  if (error instanceof ParsePlatformError) {
    if (error.code === 'unsupported-url' || error.code === 'invalid-url') {
      return '链接格式错误或暂不支持'
    }
    return error.message
  }
  return '解析失败，请稍后重试'
}

function displayPlay(value: string): string {
  return value.split('__PLAY__').filter(Boolean).join('、')
}
</script>

<template>
  <view v-if="visible" class="parse-screen">
    <AppHeader
      title="解析链接"
      show-back
      back-icon="close"
      back-label="关闭解析链接"
      @back="$emit('close')"
    />

    <scroll-view class="parse-content" scroll-y>
      <view class="parse-query">
        <view class="parse-input-wrap">
          <input
            v-model="input"
            class="parse-input"
            aria-label="粘贴演出链接"
            confirm-type="done"
            maxlength="1000"
            placeholder="粘贴链接或整段分享内容"
            @confirm="startParsing"
          >
        </view>
        <button
          class="parse-button"
          :disabled="status === 'loading' || !input.trim()"
          aria-label="解析演出链接"
          @tap="startParsing"
        >{{ status === 'loading' ? '解析中…' : '解析' }}</button>
      </view>

      <text v-if="status === 'error'" class="parse-error">{{ errorMessage }}</text>

      <view v-if="status === 'idle'" class="support-section">
        <text class="support-title">已支持平台：</text>
        <view class="support-tags app-chip-list">
          <view
            v-for="platformName in SUPPORTED_PARSE_PLATFORM_NAMES"
            :key="platformName"
            class="app-chip app-chip--level-0"
          ><text>{{ platformName }}</text></view>
        </view>
        <text class="support-note">更多平台需求，欢迎反馈</text>
      </view>

      <view v-if="status === 'ready' && parsedResult" class="preview-section">
        <view class="preview-heading">
          <text>解析结果</text>
          <text>{{ parsedResult.platformName }}</text>
        </view>

        <view class="preview-card">
          <view class="preview-row preview-row--poster">
            <text class="preview-row__label">海报</text>
            <image
              v-if="previewPosterUrl"
              class="preview-poster"
              :src="previewPosterUrl"
              mode="aspectFill"
            />
            <text v-else class="preview-row__empty">未能解析到海报</text>
          </view>
          <view class="preview-row">
            <text class="preview-row__label">名称</text>
            <text class="preview-row__value preview-row__value--wrap">{{ parsedResult.name }}</text>
          </view>
          <view class="preview-row">
            <text class="preview-row__label">主题</text>
            <text class="preview-row__value">{{ displayPlay(parsedResult.play) }}</text>
          </view>
          <view class="preview-row">
            <text class="preview-row__label">时间</text>
            <text class="preview-row__value">{{ formatParsedDate(parsedResult.startedAtMs) }}</text>
          </view>
          <view class="preview-row">
            <text class="preview-row__label">城市</text>
            <text class="preview-row__value">{{ parsedResult.city }}</text>
          </view>
          <view class="preview-row">
            <text class="preview-row__label">场地</text>
            <text class="preview-row__value">{{ parsedResult.venue }}</text>
          </view>
          <view v-if="parsedResult.artistNames.length" class="preview-row">
            <text class="preview-row__label">阵容</text>
            <text class="preview-row__value">{{ parsedResult.artistNames.join('、') }}</text>
          </view>
        </view>

        <button
          class="confirm-button"
          :disabled="preparingSelection"
          aria-label="选择需要填入的解析字段"
          @tap="prepareSelection"
        >{{ preparingSelection ? '正在准备…' : '确定' }}</button>
        <text class="result-note">数据可能存在偏差，可确定后回到编辑页面调整。</text>
      </view>
    </scroll-view>

    <view v-if="selectionVisible && parsedResult" class="field-layer">
      <button class="field-scrim" aria-label="取消选择解析字段" @tap="closeSelection" />
      <view class="field-dialog" aria-label="选择解析链接需要填入的字段">
        <text class="field-dialog__title">勾选所需字段</text>
        <text class="field-dialog__source">{{ parsedResult.name }}</text>
        <view class="field-list">
          <button
            v-for="field in fieldOptions"
            :key="field.key"
            class="field-row"
            :aria-label="`${selectedFields.includes(field.key) ? '取消填入' : '填入'}${field.label}`"
            @tap="toggleField(field.key)"
          >
            <view class="field-check" :class="{ 'field-check--selected': selectedFields.includes(field.key) }">
              <AppIcon v-if="selectedFields.includes(field.key)" name="check" />
            </view>
            <text class="field-row__label">{{ field.label }}</text>
            <text class="field-row__value">{{ field.value }}</text>
          </button>
        </view>
        <view class="field-actions">
          <button @tap="closeSelection">取消</button>
          <button aria-label="确认填入所选解析字段" @tap="confirmSelection">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.parse-screen { position: fixed; z-index: 84; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.parse-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 30rpx 28rpx calc(60rpx + env(safe-area-inset-bottom)); }
.parse-query { display: flex; align-items: stretch; gap: 14rpx; }
.parse-input-wrap { display: flex; min-width: 0; height: 78rpx; padding: 0 20rpx; flex: 1; align-items: center; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); }
.parse-input { width: 100%; height: 78rpx; color: var(--color-text); font-size: 25rpx; line-height: 78rpx; }
.parse-button { width: 124rpx; height: 78rpx; margin: 0; padding: 0; border: 0; border-radius: 16rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 25rpx; font-weight: 650; line-height: 78rpx; }
.parse-button[disabled], .confirm-button[disabled] { opacity: .5; }
.parse-button::after, .confirm-button::after, .field-scrim::after, .field-row::after, .field-actions button::after { border: 0; }
.parse-error { display: block; padding: 14rpx 8rpx; color: var(--color-danger); font-size: 22rpx; }
.support-section { padding: 38rpx 6rpx; }
.support-title { display: block; margin-bottom: 14rpx; color: var(--color-muted); font-size: 23rpx; }
.support-note, .result-note { display: block; margin-top: 22rpx; color: var(--color-muted); font-size: 21rpx; line-height: 1.55; }
.preview-section { padding-top: 32rpx; }
.preview-heading { display: flex; padding: 0 6rpx 14rpx; align-items: center; justify-content: space-between; color: var(--color-accent); font-size: 24rpx; font-weight: 650; }
.preview-heading text:last-child { color: var(--color-muted); font-size: 21rpx; font-weight: 500; }
.preview-card { overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 20rpx; background: var(--color-surface); }
.preview-row { display: flex; min-height: 76rpx; padding: 15rpx 20rpx; align-items: flex-start; gap: 16rpx; border-bottom: var(--app-border-width) solid var(--color-border-subtle); }
.preview-row:last-child { border-bottom: 0; }
.preview-row--poster { min-height: 226rpx; }
.preview-row__label { width: 74rpx; flex: none; color: var(--color-text); font-size: 24rpx; line-height: 1.45; }
.preview-row__value, .preview-row__empty { min-width: 0; overflow: hidden; flex: 1; color: var(--color-muted); font-size: 23rpx; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.preview-row__value--wrap { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
.preview-poster { width: 144rpx; height: 192rpx; border-radius: 12rpx; background: var(--color-row-pressed); object-position: center; }
.confirm-button { width: 100%; height: 82rpx; margin: 26rpx 0 0; padding: 0; border: 0; border-radius: 16rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.result-note { margin: 14rpx 6rpx 0; }
.field-layer { position: absolute; z-index: 5; inset: 0; display: flex; padding: 32rpx; align-items: center; justify-content: center; }
.field-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15, 10, 8, .52); }
.field-dialog { position: relative; z-index: 1; box-sizing: border-box; width: 100%; max-height: calc(100vh - 80rpx); padding: 30rpx; overflow: auto; border-radius: 24rpx; background: var(--color-surface); box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, .22); }
.field-dialog__title, .field-dialog__source { display: block; text-align: center; }
.field-dialog__title { font-size: 30rpx; font-weight: 700; }
.field-dialog__source { margin: 8rpx 0 20rpx; overflow: hidden; color: var(--color-muted); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.field-list { border-top: var(--app-border-width) solid var(--color-border-subtle); }
.field-row { display: flex; width: 100%; min-height: 76rpx; margin: 0; padding: 9rpx 4rpx; align-items: center; gap: 12rpx; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; }
.field-check { box-sizing: border-box; width: 34rpx; height: 34rpx; padding: 4rpx; flex: none; border: var(--app-border-width) solid var(--color-border); border-radius: 7rpx; color: transparent; }
.field-check--selected { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-on-accent); }
.field-row__label { width: 92rpx; flex: none; font-size: 24rpx; }
.field-row__value { min-width: 0; overflow: hidden; flex: 1; color: var(--color-muted); font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.field-actions { display: grid; margin-top: 22rpx; grid-template-columns: repeat(2, 1fr); gap: 14rpx; }
.field-actions button { height: 70rpx; margin: 0; border: 0; border-radius: 14rpx; background: var(--color-row-pressed); color: var(--color-muted); font-size: 25rpx; line-height: 70rpx; }
.field-actions button:last-child { background: var(--color-accent); color: var(--color-on-accent); }
</style>
