<script setup lang="ts">
interface SegmentedTab {
  value: string
  label: string
  accessibilityLabel?: string
  flex?: number
}

defineProps<{
  modelValue: string
  tabs: readonly SegmentedTab[]
  accessibilityLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <view class="segmented-tabs" :aria-label="accessibilityLabel">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="segmented-tabs__item"
      :class="{ 'segmented-tabs__item--active': modelValue === tab.value }"
      :style="{ flex: tab.flex ?? 1 }"
      :aria-label="tab.accessibilityLabel ?? tab.label"
      :aria-pressed="modelValue === tab.value"
      @tap="emit('update:modelValue', tab.value)"
    >{{ tab.label }}</button>
  </view>
</template>

<style scoped>
.segmented-tabs {
  display: flex;
  box-sizing: border-box;
  height: 64rpx;
  margin: 8rpx 28rpx 16rpx;
  padding: 4rpx;
  border: var(--app-border-width) solid var(--color-border);
  border-radius: 16rpx;
  background: var(--color-surface);
}

.segmented-tabs__item {
  min-width: 0;
  height: 54rpx;
  margin: 0;
  padding: 0 12rpx;
  border: 0;
  border-radius: 12rpx;
  background: transparent;
  color: var(--color-muted);
  font-size: 23rpx;
  font-weight: 620;
  line-height: 54rpx;
  white-space: nowrap;
}

.segmented-tabs__item::after {
  border: 0;
}

.segmented-tabs__item--active {
  background: var(--color-accent);
  color: var(--color-on-accent);
  box-shadow: 0 4rpx 10rpx var(--color-tab-shadow);
}
</style>
