<script setup lang="ts">
import EmptyIllustration from '@/components/EmptyIllustration.vue'

withDefaults(
  defineProps<{
    kind: 'records' | 'want-see' | 'imprints'
    title: string
    description: string
    actionLabel?: string
    actionStyle?: 'filled' | 'outlined'
    theme?: 'light' | 'dark'
  }>(),
  {
    actionLabel: '',
    actionStyle: 'filled',
    theme: 'light',
  },
)

defineEmits<{
  action: []
}>()
</script>

<template>
  <view class="empty-state">
    <EmptyIllustration :kind="kind" :theme="theme" />
    <view class="empty-state__copy">
      <text class="empty-state__title">{{ title }}</text>
      <text class="empty-state__description">{{ description }}</text>
    </view>
    <button
      v-if="actionLabel"
      class="empty-state__action"
      :class="`empty-state__action--${actionStyle}`"
      hover-class="empty-state__action--pressed"
      @tap="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </view>
</template>

<style scoped>
.empty-state {
  box-sizing: border-box;
  display: flex;
  min-height: calc(100vh - 368rpx - env(safe-area-inset-bottom));
  padding: 70rpx 48rpx 96rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-state__copy {
  display: flex;
  margin-top: 10rpx;
  flex-direction: column;
  align-items: center;
  gap: 22rpx;
  text-align: center;
}

.empty-state__title {
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: 700;
  letter-spacing: -0.6rpx;
  line-height: 1.25;
}

.empty-state__description {
  max-width: 600rpx;
  color: var(--color-muted);
  font-size: 28rpx;
  font-weight: 400;
  line-height: 1.65;
}

.empty-state__action {
  box-sizing: border-box;
  display: flex;
  width: min(100%, 452rpx);
  height: 92rpx;
  margin: 54rpx 0 0;
  padding: 0 32rpx;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.empty-state__action::after {
  border: 0;
}

.empty-state__action--filled {
  border: 1rpx solid var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.empty-state__action--outlined {
  border: 2rpx solid var(--color-accent);
  background: transparent;
  color: var(--color-accent);
}

.empty-state__action--pressed {
  background: var(--color-accent-pressed);
  color: var(--color-on-accent);
  transform: scale(0.98);
}

@media (max-height: 700px) {
  .empty-state {
    justify-content: flex-start;
    padding-top: 32rpx;
  }

  :deep(.illustration) {
    width: 370rpx;
  }
}
</style>
