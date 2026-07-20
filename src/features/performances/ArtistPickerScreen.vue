<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { artistNameSuggestions } from '@/features/performances/artist-names'
import {
  appendArtistName,
  moveArtistName,
  replaceArtistName,
} from '@/features/performances/editor'

const props = defineProps<{
  visible: boolean
  values: readonly string[]
  suggestions?: readonly string[]
}>()

const emit = defineEmits<{
  close: []
  'update:values': [values: string[]]
}>()

const mode = ref<'select' | 'sort'>('select')
const artistNames = ref<string[]>([])
const inputName = ref('')
const editingIndex = ref<number | null>(null)
const editingName = ref('')

const title = computed(() => mode.value === 'sort' ? '调整顺序' : '选择阵容')
const filteredSuggestions = computed(() => {
  return artistNameSuggestions(props.suggestions ?? [], inputName.value, 50)
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  mode.value = 'select'
  artistNames.value = [...props.values]
  inputName.value = ''
  cancelEditing()
}, { immediate: true })

function publish(values: string[]): void {
  artistNames.value = values
  emit('update:values', [...values])
}

function addArtist(): void {
  const normalized = inputName.value.trim()
  if (!normalized) return
  const next = appendArtistName(artistNames.value, normalized)
  if (next.length === artistNames.value.length) {
    uni.showToast({ title: '该阵容已添加', icon: 'none' })
    return
  }
  publish(next)
  inputName.value = ''
}

function chooseSuggestion(name: string): void {
  const next = appendArtistName(artistNames.value, name)
  if (next.length !== artistNames.value.length) publish(next)
  inputName.value = ''
}

function removeArtist(index: number): void {
  if (!artistNames.value[index]) return
  publish(artistNames.value.filter((_, currentIndex) => currentIndex !== index))
}

function beginEditing(index: number): void {
  const current = artistNames.value[index]
  if (!current) return
  editingIndex.value = index
  editingName.value = current
}

function cancelEditing(): void {
  editingIndex.value = null
  editingName.value = ''
}

function saveEditing(): void {
  if (editingIndex.value === null || !editingName.value.trim()) return
  publish(replaceArtistName(artistNames.value, editingIndex.value, editingName.value))
  cancelEditing()
}

function moveArtist(index: number, offset: -1 | 1): void {
  publish(moveArtistName(artistNames.value, index, index + offset))
}

function handleBack(): void {
  if (mode.value === 'sort') {
    mode.value = 'select'
    return
  }
  emit('close')
}

function handleConfirm(): void {
  if (mode.value === 'sort') {
    mode.value = 'select'
    return
  }
  emit('close')
}
</script>

<template>
  <view v-if="visible" class="artist-picker-screen">
    <AppHeader
      :title="title"
      show-back
      show-save
      :back-icon="mode === 'select' ? 'close' : 'arrow-left'"
      :back-label="mode === 'select' ? '关闭阵容选择' : '返回阵容选择'"
      save-label="确定"
      @back="handleBack"
      @save="handleConfirm"
    />

    <scroll-view v-if="mode === 'select'" class="artist-picker-content" scroll-y>
      <view v-if="artistNames.length" class="selected-section">
        <view class="selection-heading">
          <view class="selection-count">
            <text>已选择:</text>
            <text>{{ artistNames.length }}</text>
          </view>
          <button
            v-if="artistNames.length > 1"
            class="sort-button"
            aria-label="调整阵容顺序"
            @tap="mode = 'sort'"
          >调整顺序</button>
        </view>
        <text v-if="artistNames.length > 1" class="selection-hint">点击单个阵容可修改名称</text>
        <view class="artist-chips">
          <view v-for="(artist, index) in artistNames" :key="`${artist}-${index}`" class="artist-chip">
            <button class="artist-chip__name" :aria-label="`修改阵容${artist}`" @tap="beginEditing(index)">{{ artist }}</button>
            <button class="artist-chip__remove" :aria-label="`删除阵容${artist}`" @tap="removeArtist(index)">
              <AppIcon name="close" />
            </button>
          </view>
        </view>
      </view>

      <view class="manual-entry">
        <input
          v-model="inputName"
          class="artist-input"
          aria-label="阵容名称"
          maxlength="100"
          confirm-type="done"
          placeholder="请输入名称"
          @confirm="addArtist"
        >
        <button
          class="add-button"
          :disabled="!inputName.trim()"
          aria-label="添加阵容名称"
          @tap="addArtist"
        >添加</button>
      </view>
      <view v-if="filteredSuggestions.length" class="suggestion-list">
        <text class="suggestion-list__title">预选阵容</text>
        <button
          v-for="suggestion in filteredSuggestions"
          :key="suggestion"
          class="suggestion-row"
          :aria-label="`选择阵容${suggestion}`"
          @tap="chooseSuggestion(suggestion)"
        >
          <text>{{ suggestion }}</text>
          <view v-if="artistNames.includes(suggestion)" class="suggestion-row__check"><AppIcon name="check" /></view>
        </button>
      </view>
      <text v-if="!artistNames.length" class="empty-hint">逐个输入阵容名称并添加</text>
    </scroll-view>

    <scroll-view v-else class="sort-content" scroll-y>
      <text class="sort-hint">使用右侧按钮调整阵容显示顺序</text>
      <view class="sort-list">
        <view v-for="(artist, index) in artistNames" :key="`${artist}-${index}`" class="sort-row">
          <text class="sort-row__index">{{ index + 1 }}</text>
          <text class="sort-row__name">{{ artist }}</text>
          <view class="sort-row__actions">
            <button :disabled="index === 0" :aria-label="`上移${artist}`" @tap="moveArtist(index, -1)">
              <AppIcon name="chevron" />
            </button>
            <button :disabled="index === artistNames.length - 1" :aria-label="`下移${artist}`" @tap="moveArtist(index, 1)">
              <AppIcon name="chevron" />
            </button>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="editingIndex !== null" class="edit-layer">
      <button class="edit-scrim" aria-label="取消修改阵容" @tap="cancelEditing" />
      <view class="edit-dialog" aria-label="修改阵容名称">
        <text class="edit-dialog__title">修改名称</text>
        <input v-model="editingName" aria-label="新的阵容名称" maxlength="100" placeholder="请输入名称">
        <view class="edit-dialog__actions">
          <button @tap="cancelEditing">取消</button>
          <button :disabled="!editingName.trim()" @tap="saveEditing">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.artist-picker-screen { position: fixed; z-index: 70; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.artist-picker-content, .sort-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 30rpx 30rpx calc(70rpx + env(safe-area-inset-bottom)); }
.selected-section { padding-bottom: 14rpx; }
.selection-heading { display: flex; min-height: 60rpx; align-items: center; gap: 14rpx; }
.selection-count { display: flex; align-items: center; gap: 8rpx; color: var(--color-muted); font-size: 24rpx; }
.selection-count > text:last-child { color: var(--color-accent); font-weight: 700; }
.sort-button { height: 54rpx; margin: 0; padding: 0 18rpx; border: 0; border-radius: 14rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 23rpx; line-height: 54rpx; }
.selection-hint { display: block; margin: 7rpx 0 20rpx; color: var(--color-muted); font-size: 22rpx; }
.artist-chips { display: flex; flex-wrap: wrap; gap: 18rpx 14rpx; padding: 4rpx 4rpx 18rpx 0; }
.artist-chip { position: relative; display: flex; min-width: 0; max-width: 100%; align-items: center; border-radius: 17rpx; background: var(--color-accent-soft); }
.artist-chip__name { max-width: 100%; height: 64rpx; margin: 0; padding: 0 31rpx 0 22rpx; overflow: hidden; border: 0; background: transparent; color: var(--color-accent); font-size: 24rpx; line-height: 64rpx; text-overflow: ellipsis; white-space: nowrap; }
.artist-chip__remove { position: absolute; top: -12rpx; right: -12rpx; width: 37rpx; height: 37rpx; margin: 0; padding: 8rpx; border: 2rpx solid var(--color-background); border-radius: 50%; background: var(--color-accent); color: var(--color-on-accent); }
.manual-entry { display: flex; margin-top: 18rpx; align-items: center; gap: 14rpx; }
.artist-input { box-sizing: border-box; min-width: 0; height: 82rpx; padding: 0 20rpx; flex: 1; border: 1rpx solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); color: var(--color-text); font-size: 27rpx; }
.add-button { width: 120rpx; height: 72rpx; margin: 0; padding: 0; border: 0; border-radius: 16rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 25rpx; font-weight: 650; line-height: 72rpx; }
.add-button[disabled] { background: var(--color-border); color: var(--color-muted); }
.empty-hint { display: block; margin-top: 22rpx; color: var(--color-muted); font-size: 22rpx; text-align: center; }
.suggestion-list { margin-top: 18rpx; overflow: hidden; border: 1rpx solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.suggestion-list__title { display: block; padding: 16rpx 20rpx 12rpx; color: var(--color-muted); font-size: 21rpx; }
.suggestion-row { display: flex; width: 100%; min-height: 74rpx; margin: 0; padding: 0 20rpx; align-items: center; border: 0; border-top: 1rpx solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); font-size: 25rpx; text-align: left; }
.suggestion-row:first-child { border-top: 0; }
.suggestion-row > text { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.suggestion-row__check { width: 30rpx; height: 30rpx; flex: none; color: var(--color-accent); }
.sort-hint { display: block; margin-bottom: 18rpx; color: var(--color-muted); font-size: 22rpx; }
.sort-list { overflow: hidden; border: 1rpx solid var(--color-border); border-radius: 20rpx; background: var(--color-surface); }
.sort-row { display: flex; min-height: 92rpx; padding: 0 18rpx; align-items: center; gap: 16rpx; border-top: 1rpx solid var(--color-border-subtle); }
.sort-row:first-child { border-top: 0; }
.sort-row__index { display: flex; width: 42rpx; height: 42rpx; align-items: center; justify-content: center; flex: none; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); font-size: 21rpx; font-weight: 700; }
.sort-row__name { min-width: 0; flex: 1; overflow: hidden; font-size: 26rpx; text-overflow: ellipsis; white-space: nowrap; }
.sort-row__actions { display: flex; gap: 8rpx; }
.sort-row__actions button { width: 54rpx; height: 54rpx; margin: 0; padding: 15rpx; border: 0; border-radius: 14rpx; background: var(--color-accent-soft); color: var(--color-accent); }
.sort-row__actions button:first-child { transform: rotate(-90deg); }
.sort-row__actions button:last-child { transform: rotate(90deg); }
.sort-row__actions button[disabled] { color: var(--color-muted); opacity: .35; }
.edit-layer { position: absolute; z-index: 2; inset: 0; display: flex; padding: 32rpx; align-items: center; justify-content: center; }
.edit-scrim { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: rgba(15, 10, 8, .48); }
.edit-dialog { position: relative; z-index: 1; box-sizing: border-box; width: 100%; max-width: 660rpx; padding: 30rpx; border-radius: 24rpx; background: var(--color-surface); box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, .22); }
.edit-dialog__title { display: block; margin-bottom: 22rpx; font-size: 30rpx; font-weight: 700; }
.edit-dialog input { box-sizing: border-box; width: 100%; height: 78rpx; padding: 0 18rpx; border: 1rpx solid var(--color-border); border-radius: 15rpx; color: var(--color-text); font-size: 26rpx; }
.edit-dialog__actions { display: grid; margin-top: 24rpx; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.edit-dialog__actions button { height: 72rpx; margin: 0; border: 0; border-radius: 15rpx; background: var(--color-row-pressed); color: var(--color-muted); font-size: 25rpx; line-height: 72rpx; }
.edit-dialog__actions button:last-child { background: var(--color-accent); color: var(--color-on-accent); }
.edit-dialog__actions button[disabled] { background: var(--color-border); color: var(--color-muted); }
.sort-button::after, .artist-chip__name::after, .artist-chip__remove::after, .add-button::after, .suggestion-row::after, .sort-row__actions button::after, .edit-scrim::after, .edit-dialog__actions button::after { border: 0; }
</style>
