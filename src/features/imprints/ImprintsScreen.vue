<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import EmptyState from '@/components/EmptyState.vue'

defineEmits<{
  plannedAction: [message: string]
}>()
</script>

<template>
  <view class="screen">
    <AppHeader
      title="印记"
      show-calendar
      @calendar="$emit('plannedAction', '印记日历将在 Milestone 4 开放')"
    />
    <EmptyState
      kind="imprints"
      title="还没有可以回顾的印记"
      description="完成演出记录后，时间与足迹会在这里慢慢展开"
    />
  </view>
</template>
