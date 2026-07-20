<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { PerformanceCategory, PerformanceTag } from '@/domain/reference-data'
import type { ReferenceDataRepository } from '@/features/reference-data/repository'
import { getAppRepositories } from '@/platform/repositories/context'

type ReferenceKind = 'category' | 'tag'
type ReferenceItem = PerformanceCategory | PerformanceTag

const props = defineProps<{
  kind: ReferenceKind
}>()

defineEmits<{
  back: []
}>()

const repository = ref<ReferenceDataRepository | null>(null)
const items = ref<ReferenceItem[]>([])
const newName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')
const loading = ref(true)
const saving = ref(false)
const busyId = ref<string | null>(null)

const copy = computed(() => props.kind === 'category'
  ? {
      title: '分类管理',
      createTitle: '创建分类',
      placeholder: '请输入分类名称',
      itemName: '分类',
      emptyTitle: '还没有分类',
      emptyDescription: '创建分类后，可以在演出记录中选择',
    }
  : {
      title: '标签管理',
      createTitle: '创建标签',
      placeholder: '请输入标签名称',
      itemName: '标签',
      emptyTitle: '还没有标签',
      emptyDescription: '创建标签后，可以为演出添加多个标签',
    })

const canCreate = computed(() => newName.value.trim().length > 0 && !saving.value)

onMounted(async () => {
  try {
    repository.value = (await getAppRepositories()).referenceData
    await refresh()
  } catch (error) {
    showError(error, '数据初始化失败')
  } finally {
    loading.value = false
  }
})

async function refresh(): Promise<void> {
  if (!repository.value) return
  items.value = props.kind === 'category'
    ? await repository.value.listCategories()
    : await repository.value.listTags()
}

async function createItem(): Promise<void> {
  const name = newName.value.trim()
  if (!repository.value || !name || saving.value) return

  saving.value = true
  try {
    if (props.kind === 'category') {
      await repository.value.saveCategory({ name })
    } else {
      await repository.value.saveTag({ name })
    }
    newName.value = ''
    await refresh()
    showSuccess(`${copy.value.itemName}已创建`)
  } catch (error) {
    showError(error, `创建${copy.value.itemName}失败`)
  } finally {
    saving.value = false
  }
}

function beginEditing(item: ReferenceItem): void {
  editingId.value = item.id
  editingName.value = item.name
}

function cancelEditing(): void {
  editingId.value = null
  editingName.value = ''
}

async function saveEditing(item: ReferenceItem): Promise<void> {
  const name = editingName.value.trim()
  if (!repository.value || !name || busyId.value) return

  busyId.value = item.id
  try {
    if (props.kind === 'category') {
      await repository.value.saveCategory({ id: item.id, name, sortOrder: item.sortOrder })
    } else {
      await repository.value.saveTag({ id: item.id, name, sortOrder: item.sortOrder })
    }
    cancelEditing()
    await refresh()
    showSuccess(`${copy.value.itemName}已更新`)
  } catch (error) {
    showError(error, `更新${copy.value.itemName}失败`)
  } finally {
    busyId.value = null
  }
}

function requestDelete(item: ReferenceItem): void {
  uni.showModal({
    title: `删除${copy.value.itemName}`,
    content: `确定删除“${item.name}”吗？\n这不会删除关联演出。`,
    cancelText: '取消',
    confirmText: '删除',
    confirmColor: '#b43b32',
    success: async ({ confirm }) => {
      if (confirm) await removeItem(item)
    },
  })
}

async function removeItem(item: ReferenceItem): Promise<void> {
  if (!repository.value || busyId.value) return
  busyId.value = item.id
  try {
    if (props.kind === 'category') {
      await repository.value.removeCategory(item.id)
    } else {
      await repository.value.removeTag(item.id)
    }
    if (editingId.value === item.id) cancelEditing()
    await refresh()
    showSuccess(`${copy.value.itemName}已删除`)
  } catch (error) {
    showError(error, `删除${copy.value.itemName}失败`)
  } finally {
    busyId.value = null
  }
}

function showSuccess(title: string): void {
  uni.showToast({ title, icon: 'success', duration: 1200 })
}

function showError(error: unknown, fallback: string): void {
  const title = error instanceof Error && error.message ? error.message : fallback
  uni.showToast({ title, icon: 'none', duration: 2200 })
}
</script>

<template>
  <view class="reference-screen">
    <AppHeader :title="copy.title" show-back @back="$emit('back')" />

    <scroll-view class="reference-content" scroll-y>
      <view class="reference-section reference-section--create">
        <text class="reference-section__title">{{ copy.createTitle }}</text>
        <view class="create-row">
          <input
            v-model="newName"
            class="name-input"
            :placeholder="copy.placeholder"
            placeholder-class="name-input__placeholder"
            :disabled="saving"
            :maxlength="40"
            confirm-type="done"
            @confirm="createItem"
          >
          <button
            class="text-action"
            :class="{ 'text-action--disabled': !canCreate }"
            :disabled="!canCreate"
            :aria-label="`创建${copy.itemName}`"
            hover-class="text-action--pressed"
            @tap="createItem"
          >
            {{ saving ? '保存中' : '确定' }}
          </button>
        </view>
      </view>

      <view class="reference-section reference-section--list">
        <view class="list-heading">
          <text class="reference-section__title">已创建</text>
          <text v-if="items.length" class="list-heading__count">{{ items.length }} 个</text>
        </view>

        <view v-if="loading" class="reference-message">
          <text class="reference-message__title">正在载入…</text>
        </view>

        <view v-else-if="items.length === 0" class="reference-message">
          <view class="reference-message__icon"><AppIcon :name="kind === 'category' ? 'folder' : 'tag'" /></view>
          <text class="reference-message__title">{{ copy.emptyTitle }}</text>
          <text class="reference-message__description">{{ copy.emptyDescription }}</text>
        </view>

        <view v-else class="reference-list">
          <view v-for="item in items" :key="item.id" class="reference-row">
            <template v-if="editingId === item.id">
              <input
                v-model="editingName"
                class="name-input name-input--editing"
                :placeholder="copy.placeholder"
                :maxlength="40"
                :disabled="busyId === item.id"
                confirm-type="done"
                @confirm="saveEditing(item)"
              >
              <button
                class="icon-action icon-action--confirm"
                :disabled="!editingName.trim() || busyId === item.id"
                :aria-label="`保存${item.name}`"
                hover-class="icon-action--pressed"
                @tap="saveEditing(item)"
              >
                <AppIcon name="check" />
              </button>
              <button
                class="icon-action"
                :disabled="busyId === item.id"
                :aria-label="`取消编辑${item.name}`"
                hover-class="icon-action--pressed"
                @tap="cancelEditing"
              >
                <AppIcon name="close" />
              </button>
            </template>

            <template v-else>
              <view class="reference-row__body">
                <text class="reference-row__name">{{ item.name }}</text>
              </view>
              <button
                class="icon-action"
                :disabled="busyId !== null"
                :aria-label="`编辑${item.name}`"
                hover-class="icon-action--pressed"
                @tap="beginEditing(item)"
              >
                <AppIcon name="edit" />
              </button>
              <button
                class="icon-action icon-action--danger"
                :disabled="busyId !== null"
                :aria-label="`删除${item.name}`"
                hover-class="icon-action--pressed"
                @tap="requestDelete(item)"
              >
                <AppIcon name="trash" />
              </button>
            </template>
          </view>
        </view>
      </view>

      <text class="reference-footnote">删除{{ copy.itemName }}不会删除已有演出记录</text>
    </scroll-view>
  </view>
</template>

<style scoped>
.reference-screen {
  min-height: 100vh;
  background: var(--color-background);
}

.reference-content {
  box-sizing: border-box;
  height: calc(100vh - var(--app-header-height));
  padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
}

.reference-section {
  border-bottom: 1rpx solid var(--color-border);
}

.reference-section--create {
  padding: 46rpx 34rpx 36rpx;
}

.reference-section--list {
  padding-top: 42rpx;
}

.reference-section__title {
  display: block;
  color: var(--color-accent);
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.35;
}

.create-row {
  display: flex;
  margin-top: 20rpx;
  align-items: center;
  gap: 18rpx;
}

.name-input {
  box-sizing: border-box;
  min-width: 0;
  height: 86rpx;
  padding: 0 24rpx;
  flex: 1;
  border: 1rpx solid var(--color-border);
  border-radius: 18rpx;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 29rpx;
  line-height: 86rpx;
}

.name-input:focus {
  border-color: var(--color-accent);
}

.name-input__placeholder {
  color: var(--color-muted);
}

.name-input--editing {
  height: 74rpx;
  line-height: 74rpx;
}

.text-action,
.icon-action {
  box-sizing: border-box;
  display: flex;
  margin: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--color-accent);
}

.text-action::after,
.icon-action::after {
  border: 0;
}

.text-action {
  min-width: 104rpx;
  height: 76rpx;
  padding: 0 12rpx;
  font-size: 29rpx;
  font-weight: 600;
}

.text-action--disabled {
  color: var(--color-muted);
  opacity: 0.5;
}

.text-action--pressed,
.icon-action--pressed {
  border-radius: 16rpx;
  background: var(--color-accent-soft);
}

.list-heading {
  display: flex;
  padding: 0 34rpx 20rpx;
  align-items: center;
  justify-content: space-between;
}

.list-heading__count {
  color: var(--color-muted);
  font-size: 25rpx;
}

.reference-list {
  border-top: 1rpx solid var(--color-border-subtle);
}

.reference-row {
  display: flex;
  min-height: 108rpx;
  margin-left: 34rpx;
  padding: 16rpx 26rpx 16rpx 0;
  align-items: center;
  gap: 10rpx;
  border-bottom: 1rpx solid var(--color-border-subtle);
}

.reference-row:last-child {
  border-bottom: 0;
}

.reference-row__body {
  min-width: 0;
  flex: 1;
}

.reference-row__name {
  display: block;
  overflow: hidden;
  color: var(--color-text);
  font-size: 31rpx;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-action {
  width: 72rpx;
  height: 72rpx;
  padding: 20rpx;
  flex: none;
}

.icon-action--confirm {
  color: var(--color-accent);
}

.icon-action--danger {
  color: #b43b32;
}

.reference-message {
  display: flex;
  min-height: 340rpx;
  padding: 58rpx 40rpx 68rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.reference-message__icon {
  width: 64rpx;
  height: 64rpx;
  margin-bottom: 22rpx;
  color: var(--color-accent);
}

.reference-message__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 600;
}

.reference-message__description {
  max-width: 520rpx;
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 25rpx;
  line-height: 1.55;
}

.reference-footnote {
  display: block;
  padding: 32rpx 34rpx 0;
  color: var(--color-muted);
  font-size: 23rpx;
  line-height: 1.5;
  text-align: center;
}
</style>
