<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import EmptyState from '@/components/EmptyState.vue'

defineProps<{
  theme: 'light' | 'dark'
}>()

defineEmits<{
  plannedAction: [message: string]
}>()
</script>

<template>
  <view class="screen">
    <AppHeader
      title="记录现场"
      count="0 场"
      show-search
      show-add
      @search="$emit('plannedAction', '搜索将在 Milestone 2 开放')"
      @add="$emit('plannedAction', '演出记录将在 Milestone 2 开放')"
    />
    <EmptyState
      kind="records"
      :theme="theme"
      title="还没有演出记录"
      description="记录看过的现场，让每一次心动都有迹可循"
      action-label="记录第一场演出"
      @action="$emit('plannedAction', '演出记录将在 Milestone 2 开放')"
    />
  </view>
</template>
