<script setup lang="ts">
import { ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { moveSelectedName } from '@/features/performances/editor'
import {
  PURCHASE_CHANNELS_STORAGE_KEY,
  purchaseChannelOptions,
} from '@/features/performances/purchase-channels'
import { getAppRepositories } from '@/platform/repositories/context'

const props = defineProps<{
  visible: boolean
  value: string
}>()

const emit = defineEmits<{
  close: []
  'update:value': [value: string]
}>()

const mode = ref<'select' | 'edit'>('select')
const channels = ref<string[]>([])
const selectedChannel = ref('')
const newName = ref('')

watch(() => props.visible, async (visible) => {
  if (!visible) return
  mode.value = 'select'
  selectedChannel.value = props.value.trim()
  newName.value = ''
  channels.value = purchaseChannelOptions(await readStoredChannels(), selectedChannel.value)
}, { immediate: true })

async function readStoredChannels(): Promise<unknown> {
  try {
    const repositories = await getAppRepositories()
    return repositories.settings.get<unknown>(PURCHASE_CHANNELS_STORAGE_KEY)
  } catch {
    return undefined
  }
}

async function persistChannels(): Promise<void> {
  try {
    const repositories = await getAppRepositories()
    await repositories.settings.set(PURCHASE_CHANNELS_STORAGE_KEY, [...channels.value])
  } catch {
    uni.showToast({ title: '渠道列表保存失败', icon: 'none' })
  }
}

function addChannel(): void {
  const name = newName.value.trim()
  if (!name) return
  if (!channels.value.includes(name)) {
    channels.value = [name, ...channels.value]
    void persistChannels()
  }
  selectedChannel.value = name
  newName.value = ''
}

function toggleChannel(channel: string): void {
  selectedChannel.value = selectedChannel.value === channel ? '' : channel
}

function removeChannel(index: number): void {
  const channel = channels.value[index]
  if (!channel) return
  channels.value = channels.value.filter((_, currentIndex) => currentIndex !== index)
  if (selectedChannel.value === channel) selectedChannel.value = ''
  void persistChannels()
}

function moveChannel(index: number, offset: -1 | 1): void {
  channels.value = moveSelectedName(channels.value, index, index + offset)
  void persistChannels()
}

function handleBack(): void {
  if (mode.value === 'edit') {
    mode.value = 'select'
    return
  }
  emit('close')
}

function handleConfirm(): void {
  if (mode.value === 'edit') {
    mode.value = 'select'
    return
  }
  emit('update:value', selectedChannel.value)
  emit('close')
}
</script>

<template>
  <view v-if="visible" class="channel-picker-screen">
    <AppHeader
      :title="mode === 'edit' ? '编辑购票渠道' : '选择购票渠道'"
      show-back
      show-save
      :back-icon="mode === 'edit' ? 'arrow-left' : 'close'"
      :back-label="mode === 'edit' ? '返回购票渠道选择' : '关闭购票渠道选择'"
      :save-label="mode === 'edit' ? '完成' : '确定'"
      @back="handleBack"
      @save="handleConfirm"
    />

    <scroll-view v-if="mode === 'select'" class="channel-picker-content" scroll-y>
      <view class="channel-section">
        <text class="channel-section__title">新增购票渠道</text>
        <view class="channel-entry">
          <input
            v-model="newName"
            aria-label="购票渠道名称"
            maxlength="80"
            confirm-type="done"
            placeholder="请输入购票渠道名称"
            @confirm="addChannel"
          >
          <button
            :disabled="!newName.trim()"
            aria-label="新增购票渠道"
            @tap="addChannel"
          >确定</button>
        </view>
      </view>

      <view class="channel-section channel-section--list">
        <view class="channel-list-heading">
          <text class="channel-section__title">选择购票渠道</text>
          <button v-if="channels.length" aria-label="编辑购票渠道" @tap="mode = 'edit'">编辑</button>
        </view>
        <button
          v-for="channel in channels"
          :key="channel"
          class="channel-row"
          :class="{ 'channel-row--selected': selectedChannel === channel }"
          :aria-label="`选择购票渠道${channel}`"
          @tap="toggleChannel(channel)"
        >
          <text>{{ channel }}</text>
          <view v-if="selectedChannel === channel" class="channel-row__check"><AppIcon name="check" /></view>
        </button>
        <text v-if="!channels.length" class="empty-hint">暂无购票渠道，可在上方新增</text>
      </view>
    </scroll-view>

    <scroll-view v-else class="channel-picker-content" scroll-y>
      <text class="edit-hint">删除渠道或使用右侧按钮调整显示顺序</text>
      <view class="edit-list">
        <view v-for="(channel, index) in channels" :key="channel" class="edit-row">
          <text class="edit-row__index">{{ index + 1 }}</text>
          <text class="edit-row__name">{{ channel }}</text>
          <button :aria-label="`删除购票渠道${channel}`" class="edit-row__delete" @tap="removeChannel(index)">
            <AppIcon name="trash" />
          </button>
          <button :disabled="index === 0" :aria-label="`上移${channel}`" @tap="moveChannel(index, -1)">
            <AppIcon name="chevron" />
          </button>
          <button :disabled="index === channels.length - 1" :aria-label="`下移${channel}`" @tap="moveChannel(index, 1)">
            <AppIcon name="chevron" />
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.channel-picker-screen { position: fixed; z-index: 75; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.channel-picker-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 24rpx 30rpx calc(70rpx + env(safe-area-inset-bottom)); }
.channel-section { padding: 14rpx 0 28rpx; }
.channel-section--list { padding-top: 4rpx; }
.channel-section__title { color: var(--color-muted); font-size: 23rpx; font-weight: 600; }
.channel-entry { display: flex; margin-top: 16rpx; align-items: center; gap: 14rpx; }
.channel-entry input { box-sizing: border-box; min-width: 0; height: 78rpx; padding: 0 20rpx; flex: 1; border: var(--app-border-width) solid var(--color-border); border-radius: 15rpx; background: var(--color-surface); color: var(--color-text); font-size: 26rpx; }
.channel-entry button { width: 112rpx; height: 68rpx; margin: 0; padding: 0; border: 0; border-radius: 15rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 24rpx; line-height: 68rpx; }
.channel-entry button[disabled] { background: var(--color-border); color: var(--color-muted); }
.channel-list-heading { display: flex; min-height: 58rpx; align-items: center; justify-content: space-between; }
.channel-list-heading button { height: 52rpx; margin: 0; padding: 0 18rpx; border: 0; border-radius: 13rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 23rpx; line-height: 52rpx; }
.channel-row { display: flex; width: 100%; min-height: 82rpx; margin: 0; padding: 0 18rpx; align-items: center; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); font-size: 27rpx; text-align: left; }
.channel-row > text { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.channel-row__check { width: 31rpx; height: 31rpx; flex: none; color: var(--color-accent); }
.channel-row--selected { color: var(--color-accent); }
.empty-hint, .edit-hint { display: block; color: var(--color-muted); font-size: 22rpx; }
.empty-hint { padding: 38rpx 0; text-align: center; }
.edit-hint { margin: 8rpx 0 18rpx; }
.edit-list { overflow: hidden; border: var(--app-border-width) solid var(--color-border); border-radius: 18rpx; background: var(--color-surface); }
.edit-row { display: flex; min-height: 88rpx; padding: 0 14rpx; align-items: center; gap: 10rpx; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.edit-row:first-child { border-top: 0; }
.edit-row__index { display: flex; width: 38rpx; height: 38rpx; align-items: center; justify-content: center; flex: none; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent); font-size: 20rpx; }
.edit-row__name { min-width: 0; flex: 1; overflow: hidden; font-size: 25rpx; text-overflow: ellipsis; white-space: nowrap; }
.edit-row button { width: 52rpx; height: 52rpx; margin: 0; padding: 14rpx; border: 0; border-radius: 13rpx; background: var(--color-accent-soft); color: var(--color-accent); }
.edit-row button:nth-last-child(2) { transform: rotate(-90deg); }
.edit-row button:last-child { transform: rotate(90deg); }
.edit-row .edit-row__delete { background: transparent; color: #b43b32; transform: none; }
.edit-row button[disabled] { color: var(--color-muted); opacity: .35; }
.channel-entry button::after, .channel-list-heading button::after, .channel-row::after, .edit-row button::after { border: 0; }
</style>
