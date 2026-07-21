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
    showFilter?: boolean
    filterCount?: number
    showSave?: boolean
    showEdit?: boolean
    showDelete?: boolean
    backIcon?: 'arrow-left' | 'close'
    backLabel?: string
    saveLabel?: string
    saveDisabled?: boolean
    saving?: boolean
  }>(),
  {
    count: '',
    showSearch: false,
    showAdd: false,
    showCalendar: false,
    showBack: false,
    showFilter: false,
    filterCount: 0,
    showSave: false,
    showEdit: false,
    showDelete: false,
    backIcon: 'arrow-left',
    backLabel: '返回',
    saveLabel: '保存',
    saveDisabled: false,
    saving: false,
  },
)

defineEmits<{
  search: []
  add: []
  calendar: []
  back: []
  filter: []
  save: []
  edit: []
  delete: []
}>()
</script>

<template>
  <view class="app-header">
    <view class="app-header__bar">
      <view class="app-header__side app-header__side--left">
        <button
          v-if="showBack"
          class="icon-button icon-button--soft-accent"
          :aria-label="backLabel"
          hover-class="icon-button--soft-accent-pressed"
          @tap="$emit('back')"
        >
          <AppIcon :name="backIcon" />
        </button>
        <button
          v-else-if="showFilter"
          class="icon-button icon-button--soft-accent app-header__filter"
          :class="{ 'app-header__filter--active': filterCount > 0 }"
          aria-label="筛选演出"
          hover-class="icon-button--soft-accent-pressed"
          @tap="$emit('filter')"
        >
          <AppIcon name="filter" />
          <text v-if="filterCount" class="app-header__filter-count">{{ filterCount }}</text>
        </button>
      </view>

      <slot name="center">
        <view class="app-header__titles">
          <text class="app-header__title">{{ title }}</text>
          <text v-if="count" class="app-header__separator">✘</text>
          <text v-if="count" class="app-header__count">{{ count }}</text>
        </view>
      </slot>

      <view class="app-header__side app-header__side--right">
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
          class="icon-button icon-button--soft-accent"
          aria-label="搜索演出"
          hover-class="icon-button--soft-accent-pressed"
          @tap="$emit('search')"
        >
          <AppIcon name="search" />
        </button>
        <button
          v-if="showSave"
          class="save-button"
          :class="{ 'save-button--disabled': saveDisabled }"
          :disabled="saveDisabled"
          :aria-label="saveLabel"
          hover-class="save-button--pressed"
          @tap="$emit('save')"
        >
          {{ saving ? '保存中' : saveLabel }}
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
  </view>
</template>

<style scoped>
.app-header {
  box-sizing: border-box;
  height: var(--app-header-height, 96rpx);
  padding-top: var(--app-status-bar-height, 0px);
  border-bottom: var(--app-border-width) solid var(--color-border);
  background: var(--color-background);
}

.app-header__bar {
  display: grid;
  height: var(--app-header-bar-height, 96rpx);
  padding: 0 16rpx;
  grid-template-columns: 152rpx minmax(0, 1fr) 152rpx;
  align-items: center;
}

.app-header__titles {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  overflow: hidden;
  text-align: center;
  white-space: nowrap;
}

.app-header__title,
.app-header__separator,
.app-header__count {
  display: block;
  overflow: hidden;
  line-height: 40rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 650;
  letter-spacing: -0.4rpx;
}

.app-header__separator,
.app-header__count {
  color: var(--color-muted);
  font-size: 25rpx;
  font-weight: 400;
}

.app-header__separator {
  flex: none;
}

.app-header__filter {
  position: relative;
  overflow: visible;
}

.app-header__filter--active {
  box-shadow: inset 0 0 0 var(--app-border-width) var(--color-accent-border);
}

.app-header__filter-count {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  display: flex;
  min-width: 29rpx;
  height: 29rpx;
  padding: 0 6rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid var(--color-background);
  border-radius: 16rpx;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 17rpx;
  font-weight: 650;
  line-height: 29rpx;
}

.app-header__side {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.app-header__side--left {
  justify-content: flex-start;
}

.app-header__side--right {
  justify-content: flex-end;
}

.icon-button {
  box-sizing: border-box;
  display: flex;
  width: 68rpx;
  height: 68rpx;
  margin: 0;
  padding: 19rpx;
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

.icon-button--soft-accent,
.icon-button--accent {
  width: 64rpx;
  height: 64rpx;
  padding: 18rpx;
}

.icon-button--soft-accent {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.icon-button--accent {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.icon-button--pressed,
.icon-button--soft-accent-pressed,
.icon-button--accent-pressed {
  transform: scale(0.94);
}

.icon-button--pressed {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.icon-button--soft-accent-pressed {
  background: var(--color-row-pressed);
  color: var(--color-accent);
}

.icon-button--danger {
  color: #b5473e;
}

.icon-button--accent-pressed {
  background: var(--color-accent-pressed);
}

.save-button {
  min-width: 88rpx;
  height: 62rpx;
  margin: 0;
  padding: 0 14rpx;
  border: 0;
  border-radius: 14rpx;
  background: transparent;
  color: var(--color-accent);
  font-size: 27rpx;
  font-weight: 650;
  line-height: 62rpx;
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
