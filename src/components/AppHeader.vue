<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

withDefaults(
  defineProps<{
    title: string
    count?: string
    showSearch?: boolean
    showAdd?: boolean
    showCalendar?: boolean
    showBack?: boolean
    showSave?: boolean
    showEdit?: boolean
    showDelete?: boolean
    saveDisabled?: boolean
    saving?: boolean
  }>(),
  {
    count: '',
    showSearch: false,
    showAdd: false,
    showCalendar: false,
    showBack: false,
    showSave: false,
    showEdit: false,
    showDelete: false,
    saveDisabled: false,
    saving: false,
  },
)

defineEmits<{
  search: []
  add: []
  calendar: []
  back: []
  save: []
  edit: []
  delete: []
}>()
</script>

<template>
  <view class="app-header">
    <button
      v-if="showBack"
      class="icon-button icon-button--plain app-header__back"
      aria-label="返回"
      hover-class="icon-button--pressed"
      @tap="$emit('back')"
    >
      <AppIcon name="arrow-left" />
    </button>

    <view class="app-header__titles" :class="{ 'app-header__titles--secondary': showBack }">
      <text class="app-header__title">{{ title }}</text>
      <text v-if="count" class="app-header__count">{{ count }}</text>
    </view>

    <view class="app-header__actions">
      <button
        v-if="showEdit"
        class="icon-button icon-button--plain"
        aria-label="编辑演出"
        hover-class="icon-button--pressed"
        @tap="$emit('edit')"
      >
        <AppIcon name="edit" />
      </button>
      <button
        v-if="showDelete"
        class="icon-button icon-button--plain icon-button--danger"
        aria-label="删除演出"
        hover-class="icon-button--pressed"
        @tap="$emit('delete')"
      >
        <AppIcon name="trash" />
      </button>
      <button
        v-if="showSearch"
        class="icon-button icon-button--plain"
        aria-label="搜索演出"
        hover-class="icon-button--pressed"
        @tap="$emit('search')"
      >
        <AppIcon name="search" />
      </button>
      <button
        v-if="showSave"
        class="save-button"
        :class="{ 'save-button--disabled': saveDisabled }"
        :disabled="saveDisabled"
        aria-label="保存"
        hover-class="save-button--pressed"
        @tap="$emit('save')"
      >
        {{ saving ? '保存中' : '保存' }}
      </button>
      <button
        v-if="showCalendar"
        class="icon-button icon-button--plain"
        aria-label="切换日历视图"
        hover-class="icon-button--pressed"
        @tap="$emit('calendar')"
      >
        <AppIcon name="calendar" />
      </button>
      <button
        v-if="showAdd"
        class="icon-button icon-button--accent"
        aria-label="添加演出"
        hover-class="icon-button--accent-pressed"
        @tap="$emit('add')"
      >
        <AppIcon name="plus" />
      </button>
    </view>
  </view>
</template>

<style scoped>
.app-header {
  box-sizing: border-box;
  display: flex;
  min-height: 236rpx;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32rpx;
  padding: calc(var(--status-bar-height, 0px) + 34rpx) 38rpx 28rpx;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-background);
}

.app-header__titles {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.app-header__titles--secondary {
  flex: 1;
}

.app-header__back {
  width: 72rpx;
  height: 72rpx;
  margin: 0 4rpx 2rpx -16rpx;
  padding: 19rpx;
  flex: none;
}

.app-header__titles--secondary .app-header__title {
  font-size: 40rpx;
}

.app-header__title {
  color: var(--color-text);
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
  line-height: 1.16;
}

.app-header__count {
  color: var(--color-muted);
  font-size: 28rpx;
  font-weight: 400;
  line-height: 1.35;
}

.app-header__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 20rpx;
}

.icon-button {
  box-sizing: border-box;
  display: flex;
  width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 25rpx;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--color-text);
  font-size: 0;
  line-height: 1;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.icon-button::after {
  border: 0;
}

.icon-button--plain {
  background: transparent;
}

.icon-button--accent {
  padding: 24rpx;
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.icon-button--pressed,
.icon-button--accent-pressed {
  transform: scale(0.94);
}

.icon-button--pressed {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.icon-button--danger {
  color: #b5473e;
}

.icon-button--accent-pressed {
  background: var(--color-accent-pressed);
}

.save-button {
  min-width: 104rpx;
  height: 72rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 0;
  border-radius: 16rpx;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: 28rpx;
  font-weight: 650;
  line-height: 72rpx;
}

.save-button::after {
  border: 0;
}

.save-button--pressed {
  background: var(--color-row-pressed);
}

.save-button--disabled {
  color: var(--color-muted);
  opacity: 0.5;
}
</style>
