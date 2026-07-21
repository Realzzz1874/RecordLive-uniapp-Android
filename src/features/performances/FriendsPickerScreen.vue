<script setup lang="ts">
import { ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { moveSelectedName } from '@/features/performances/editor'
import {
  FRIENDS_STORAGE_KEY,
  friendOptions,
} from '@/features/performances/friends'

const props = defineProps<{
  visible: boolean
  values: readonly string[]
}>()

const emit = defineEmits<{
  close: []
  'update:values': [values: string[]]
}>()

const mode = ref<'select' | 'edit'>('select')
const friends = ref<string[]>([])
const selectedFriends = ref<string[]>([])
const newName = ref('')

watch(() => props.visible, (visible) => {
  if (!visible) return
  mode.value = 'select'
  selectedFriends.value = friendOptions([], props.values)
  newName.value = ''
  const stored = readStoredFriends()
  friends.value = friendOptions(stored, selectedFriends.value)
  if (friends.value.length !== friendOptions(stored).length) persistFriends()
}, { immediate: true })

function readStoredFriends(): unknown {
  try {
    return uni.getStorageSync(FRIENDS_STORAGE_KEY)
  } catch {
    return undefined
  }
}

function persistFriends(): void {
  try {
    uni.setStorageSync(FRIENDS_STORAGE_KEY, [...friends.value])
  } catch {
    uni.showToast({ title: '好友列表保存失败', icon: 'none' })
  }
}

function addFriend(): void {
  const name = newName.value.trim()
  if (!name) return
  if (!friends.value.includes(name)) {
    friends.value = [name, ...friends.value]
    persistFriends()
  }
  if (!selectedFriends.value.includes(name)) {
    selectedFriends.value = [...selectedFriends.value, name]
  }
  newName.value = ''
}

function toggleFriend(friend: string): void {
  selectedFriends.value = selectedFriends.value.includes(friend)
    ? selectedFriends.value.filter((item) => item !== friend)
    : [...selectedFriends.value, friend]
}

function removeFriend(index: number): void {
  const friend = friends.value[index]
  if (!friend) return
  friends.value = friends.value.filter((_, currentIndex) => currentIndex !== index)
  selectedFriends.value = selectedFriends.value.filter((item) => item !== friend)
  persistFriends()
}

function moveFriend(index: number, offset: -1 | 1): void {
  friends.value = moveSelectedName(friends.value, index, index + offset)
  persistFriends()
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
  emit('update:values', [...selectedFriends.value])
  emit('close')
}
</script>

<template>
  <view v-if="visible" class="friends-picker-screen">
    <AppHeader
      :title="mode === 'edit' ? '编辑同行好友' : '选择同行好友'"
      show-back
      show-save
      :back-icon="mode === 'edit' ? 'arrow-left' : 'close'"
      :back-label="mode === 'edit' ? '返回同行好友选择' : '关闭同行好友选择'"
      :save-label="mode === 'edit' ? '完成' : '确定'"
      @back="handleBack"
      @save="handleConfirm"
    />

    <scroll-view v-if="mode === 'select'" class="friends-picker-content" scroll-y>
      <view class="friends-section">
        <text class="friends-section__title">新增同行好友</text>
        <view class="friend-entry">
          <input
            v-model="newName"
            aria-label="同行好友名称"
            maxlength="80"
            confirm-type="done"
            placeholder="请输入同行好友"
            @confirm="addFriend"
          >
          <button
            :disabled="!newName.trim()"
            aria-label="新增同行好友"
            @tap="addFriend"
          >确定</button>
        </view>
      </view>

      <view v-if="friends.length" class="friends-section friends-section--list">
        <view class="friends-list-heading">
          <text class="friends-section__title">选择同行好友（可多选）</text>
          <button aria-label="编辑同行好友" @tap="mode = 'edit'">编辑</button>
        </view>
        <button
          v-for="friend in friends"
          :key="friend"
          class="friend-row"
          :class="{ 'friend-row--selected': selectedFriends.includes(friend) }"
          :aria-label="`选择同行好友${friend}`"
          @tap="toggleFriend(friend)"
        >
          <text>{{ friend }}</text>
          <view v-if="selectedFriends.includes(friend)" class="friend-row__check"><AppIcon name="check" /></view>
        </button>
      </view>
      <text v-else class="empty-hint">暂无同行好友，可在上方新增</text>
    </scroll-view>

    <scroll-view v-else class="friends-picker-content" scroll-y>
      <text class="edit-hint">删除好友或使用右侧按钮调整显示顺序</text>
      <view class="edit-list">
        <view v-for="(friend, index) in friends" :key="friend" class="edit-row">
          <text class="edit-row__index">{{ index + 1 }}</text>
          <text class="edit-row__name">{{ friend }}</text>
          <button :aria-label="`删除同行好友${friend}`" class="edit-row__delete" @tap="removeFriend(index)">
            <AppIcon name="trash" />
          </button>
          <button :disabled="index === 0" :aria-label="`上移${friend}`" @tap="moveFriend(index, -1)">
            <AppIcon name="chevron" />
          </button>
          <button :disabled="index === friends.length - 1" :aria-label="`下移${friend}`" @tap="moveFriend(index, 1)">
            <AppIcon name="chevron" />
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.friends-picker-screen { position: fixed; z-index: 76; inset: 0; width: 100%; max-width: 560px; margin: 0 auto; overflow: hidden; background: var(--color-background); color: var(--color-text); }
.friends-picker-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 24rpx 30rpx calc(70rpx + env(safe-area-inset-bottom)); }
.friends-section { padding: 14rpx 0 28rpx; }
.friends-section--list { padding-top: 4rpx; }
.friends-section__title { color: var(--color-muted); font-size: 23rpx; font-weight: 600; }
.friend-entry { display: flex; margin-top: 16rpx; align-items: center; gap: 14rpx; }
.friend-entry input { box-sizing: border-box; min-width: 0; height: 78rpx; padding: 0 20rpx; flex: 1; border: var(--app-border-width) solid var(--color-border); border-radius: 15rpx; background: var(--color-surface); color: var(--color-text); font-size: 26rpx; }
.friend-entry button { width: 112rpx; height: 68rpx; margin: 0; padding: 0; border: 0; border-radius: 15rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 24rpx; line-height: 68rpx; }
.friend-entry button[disabled] { background: var(--color-border); color: var(--color-muted); }
.friends-list-heading { display: flex; min-height: 58rpx; align-items: center; justify-content: space-between; gap: 18rpx; }
.friends-list-heading button { height: 52rpx; margin: 0; padding: 0 18rpx; flex: none; border: 0; border-radius: 13rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 23rpx; line-height: 52rpx; }
.friend-row { display: flex; width: 100%; min-height: 82rpx; margin: 0; padding: 0 18rpx; align-items: center; border: 0; border-bottom: var(--app-border-width) solid var(--color-border-subtle); border-radius: 0; background: transparent; color: var(--color-text); font-size: 27rpx; text-align: left; }
.friend-row > text { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.friend-row__check { width: 31rpx; height: 31rpx; flex: none; color: var(--color-accent); }
.friend-row--selected { color: var(--color-accent); }
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
.friend-entry button::after, .friends-list-heading button::after, .friend-row::after, .edit-row button::after { border: 0; }
</style>
