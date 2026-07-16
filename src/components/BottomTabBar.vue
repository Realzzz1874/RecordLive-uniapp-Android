<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { APP_TABS, type AppTabId } from '@/features/app-shell/model'

defineProps<{
  activeTab: AppTabId
}>()

defineEmits<{
  select: [tab: AppTabId]
}>()
</script>

<template>
  <view class="tab-bar" aria-label="主导航">
    <button
      v-for="tab in APP_TABS"
      :key="tab.id"
      class="tab-bar__item"
      :class="{ 'tab-bar__item--active': activeTab === tab.id }"
      :aria-label="tab.label"
      :aria-current="activeTab === tab.id ? 'page' : undefined"
      hover-class="tab-bar__item--pressed"
      @tap="$emit('select', tab.id)"
    >
      <view class="tab-bar__indicator" />
      <view class="tab-bar__icon">
        <AppIcon :name="tab.icon" />
      </view>
      <text class="tab-bar__label">{{ tab.label }}</text>
    </button>
  </view>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 0 10rpx env(safe-area-inset-bottom);
  border-top: 1rpx solid var(--color-border);
  background: var(--color-tab-background);
  box-shadow: 0 -10rpx 32rpx var(--color-tab-shadow);
  backdrop-filter: blur(20rpx);
}

.tab-bar__item {
  position: relative;
  box-sizing: border-box;
  display: flex;
  height: 132rpx;
  margin: 0;
  padding: 23rpx 4rpx 13rpx;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 9rpx;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-tab-idle);
  font-size: 0;
  line-height: 1;
  transition:
    color 160ms ease,
    opacity 160ms ease;
}

.tab-bar__item::after {
  border: 0;
}

.tab-bar__item--active {
  color: var(--color-accent);
}

.tab-bar__item--pressed {
  opacity: 0.66;
}

.tab-bar__indicator {
  position: absolute;
  top: -1rpx;
  left: 50%;
  width: 64rpx;
  height: 6rpx;
  border-radius: 0 0 8rpx 8rpx;
  background: var(--color-accent);
  opacity: 0;
  transform: translateX(-50%) scaleX(0.58);
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.tab-bar__item--active .tab-bar__indicator {
  opacity: 1;
  transform: translateX(-50%) scaleX(1);
}

.tab-bar__icon {
  width: 48rpx;
  height: 48rpx;
}

.tab-bar__label {
  max-width: 100%;
  overflow: hidden;
  color: currentColor;
  font-size: 25rpx;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 600px) {
  .tab-bar {
    right: 50%;
    left: auto;
    width: min(100%, 560px);
    transform: translateX(50%);
  }
}
</style>
