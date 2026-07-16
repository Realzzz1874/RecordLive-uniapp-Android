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
      title="待看"
      count="0 场"
      show-search
      show-add
      @search="$emit('plannedAction', '搜索将在 Milestone 2 开放')"
      @add="$emit('plannedAction', '待看记录将在 Milestone 2 开放')"
    />
    <EmptyState
      kind="want-see"
      title="暂无待看的演出"
      description="把想去的现场先放在这里，出发前从容准备"
      action-label="添加待看演出"
      action-style="outlined"
      @action="$emit('plannedAction', '待看记录将在 Milestone 2 开放')"
    />
  </view>
</template>
