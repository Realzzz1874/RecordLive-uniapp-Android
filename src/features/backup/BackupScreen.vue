<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import type { RestoreMode, RestorePlan } from '@/domain/backup-restore-plan'
import type { BackupSummary } from '@/features/backup/repository'
import type { RestorePreview } from '@/features/backup/use-cases'
import { getAppRepositories } from '@/platform/repositories/context'

const emit = defineEmits<{
  back: []
  restored: []
}>()

const summary = ref<BackupSummary | null>(null)
const preview = ref<RestorePreview | null>(null)
const mode = ref<RestoreMode>('merge-local-first')
const busy = ref(false)
const busyLabel = ref('')
const errorMessage = ref('')
const runtime = ref<'android' | 'h5-fake'>('android')

const selectedPlan = computed<RestorePlan | null>(() => {
  if (!preview.value) return null
  return mode.value === 'replace-all'
    ? preview.value.replacePlan
    : preview.value.mergePlan
})

onMounted(loadSummary)

async function loadSummary(): Promise<void> {
  try {
    const repositories = await getAppRepositories()
    runtime.value = repositories.backup.runtime
    summary.value = await repositories.backup.getSummary()
  } catch (error) {
    showError(error)
  }
}

async function createBackup(): Promise<void> {
  const confirmed = await confirm({
    title: '备份到文件',
    content: '备份未加密，可能包含演出地点、座位、备注和票根，请妥善保管。',
    confirmText: '继续备份',
  })
  if (!confirmed) return
  let saved = false
  await run('正在生成备份…', async () => {
    const repositories = await getAppRepositories()
    const result = await repositories.backup.createBackup()
    if (result === 'saved') {
      saved = true
      await loadSummary()
    }
  })
  if (saved) {
    uni.showToast({ title: runtime.value === 'h5-fake' ? 'H5 模拟备份完成' : '备份已保存', icon: 'success' })
  }
}

async function chooseRestore(): Promise<void> {
  let noFile = false
  await run('正在校验备份…', async () => {
    const repositories = await getAppRepositories()
    const inspected = await repositories.backup.inspectRestoreFile()
    if (!inspected) {
      noFile = runtime.value === 'h5-fake'
      return
    }
    preview.value = inspected
    mode.value = 'merge-local-first'
  })
  if (noFile) uni.showToast({ title: '请先执行一次 H5 模拟备份', icon: 'none' })
}

async function chooseRecoveryPoint(): Promise<void> {
  await run('正在校验恢复点…', async () => {
    const repositories = await getAppRepositories()
    preview.value = await repositories.backup.inspectRecoveryPoint()
    mode.value = 'replace-all'
  })
}

async function restore(): Promise<void> {
  const plan = selectedPlan.value
  const currentPreview = preview.value
  if (!plan || !currentPreview) return
  const replace = mode.value === 'replace-all'
  const confirmed = await confirm({
    title: replace ? '确认全部覆盖' : '确认合并恢复',
    content: replace
      ? '当前演出、分类、标签、用户字典、可备份设置和媒体引用将被备份内容完整替换。恢复前会自动创建内部恢复点。'
      : '将按“本机优先”新增或补齐数据，不覆盖本机已有标量字段。恢复前会自动创建内部恢复点。',
    confirmText: replace ? '全部覆盖' : '开始合并',
    confirmColor: replace ? '#b3261e' : '#a74f17',
  })
  if (!confirmed) return

  let restored = false
  await run('正在恢复，请勿关闭应用…', async () => {
    const repositories = await getAppRepositories()
    await repositories.backup.restore(currentPreview, mode.value)
    preview.value = null
    await loadSummary()
    restored = true
    emit('restored')
  })
  if (restored) uni.showToast({ title: '恢复完成', icon: 'success' })
}

async function deleteRecoveryPoint(): Promise<void> {
  const confirmed = await confirm({
    title: '删除内部恢复点',
    content: '删除后将无法撤销上一次恢复，此操作不会删除当前业务数据。',
    confirmText: '删除',
    confirmColor: '#b3261e',
  })
  if (!confirmed) return
  await run('正在删除…', async () => {
    const repositories = await getAppRepositories()
    await repositories.backup.deleteRecoveryPoint()
    await loadSummary()
  })
}

async function run(label: string, operation: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  busyLabel.value = label
  errorMessage.value = ''
  uni.showLoading({ title: label, mask: true })
  try {
    await operation()
  } catch (error) {
    showError(error)
  } finally {
    uni.hideLoading()
    busy.value = false
    busyLabel.value = ''
  }
}

function showError(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : '本地备份操作失败'
  uni.showToast({ title: errorMessage.value, icon: 'none', duration: 3200 })
}

function confirm(options: {
  title: string
  content: string
  confirmText: string
  confirmColor?: string
}): Promise<boolean> {
  return new Promise((resolve) => uni.showModal({
    ...options,
    cancelText: '取消',
    success: ({ confirm: accepted }) => resolve(accepted),
    fail: () => resolve(false),
  }))
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(value: number | null): string {
  if (value === null) return '尚未备份'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <view class="backup-screen">
    <AppHeader title="本地备份与恢复" show-back @back="$emit('back')" />

    <scroll-view class="backup-content" scroll-y>

      <view class="summary-card">
        <view class="summary-card__heading">
          <text class="summary-card__title">本机数据</text>
          <text class="summary-card__status">快照</text>
        </view>
        <view class="summary-grid">
          <view>
            <text class="summary-grid__value">{{ summary?.performanceCount ?? '—' }}</text>
            <text class="summary-grid__label">演出</text>
          </view>
          <view>
            <text class="summary-grid__value">{{ summary?.mediaCount ?? '—' }}</text>
            <text class="summary-grid__label">媒体文件</text>
          </view>
          <view>
            <text class="summary-grid__value">{{ summary ? formatBytes(summary.mediaBytes) : '—' }}</text>
            <text class="summary-grid__label">媒体文件大小</text>
          </view>
        </view>
        <text class="last-backup">上次成功备份：{{ formatDate(summary?.lastBackupAtMs ?? null) }}</text>
      </view>

      <view class="action-section">
        <button class="primary-action" :disabled="busy" @tap="createBackup">备份到文件</button>
        <button class="secondary-action" :disabled="busy" @tap="chooseRestore">从文件恢复</button>
      </view>

      <view v-if="preview && selectedPlan" class="preview-card">
        <text class="section-eyebrow">已通过完整性校验</text>
        <text class="preview-card__title">{{ preview.archive.selected.displayName }}</text>
        <text class="preview-card__meta">
          {{ formatDate(preview.archive.manifest.exportedAtMs) }} ·
          {{ preview.archive.data.performances.length }} 场演出 ·
          {{ preview.archive.data.mediaAssets.length }} 个媒体文件
        </text>

        <view class="mode-selector" role="radiogroup" aria-label="恢复方式">
          <button
            class="mode-option"
            :class="{ 'mode-option--active': mode === 'merge-local-first' }"
            :aria-checked="mode === 'merge-local-first'"
            @tap="mode = 'merge-local-first'"
          >
            <text class="mode-option__title">与本机合并</text>
            <text>本机优先，只新增或补齐</text>
          </button>
          <button
            class="mode-option"
            :class="{ 'mode-option--active mode-option--danger': mode === 'replace-all' }"
            :aria-checked="mode === 'replace-all'"
            @tap="mode = 'replace-all'"
          >
            <text class="mode-option__title">全部覆盖</text>
            <text>用备份完整替换当前数据</text>
          </button>
        </view>

        <view v-if="mode === 'merge-local-first'" class="plan-summary">
          <text>新增演出 {{ selectedPlan.summary.performancesAdded }}</text>
          <text>复用演出 {{ selectedPlan.summary.performancesReused }}</text>
          <text>补齐关系 {{ selectedPlan.summary.relationshipsAdded }}</text>
          <text>补齐媒体文件 {{ selectedPlan.summary.mediaAdded }}</text>
          <text>跳过冲突字段 {{ selectedPlan.summary.conflictsSkipped }}</text>
          <text>疑似重复 {{ selectedPlan.summary.suspectedDuplicates }}</text>
        </view>
        <view v-else class="replace-warning">
          当前数据将被完整替换；空备份也会清空演出、分类和标签。
        </view>
        <text v-for="warning in selectedPlan.warnings" :key="warning" class="plan-warning">{{ warning }}</text>

        <button class="confirm-action" :class="{ 'confirm-action--danger': mode === 'replace-all' }" @tap="restore">
          {{ mode === 'replace-all' ? '确认全部覆盖' : '确认合并恢复' }}
        </button>
        <button class="cancel-action" @tap="preview = null">取消本次恢复</button>
      </view>

      <view v-if="summary?.hasRecoveryPoint && !preview" class="recovery-card">
        <text class="recovery-card__title">内部恢复点</text>
        <text class="recovery-card__description">恢复前自动保存，可用于撤销上一次恢复。</text>
        <view class="recovery-card__actions">
          <button @tap="chooseRecoveryPoint">撤销上次恢复</button>
          <button class="danger-link" @tap="deleteRecoveryPoint">删除恢复点</button>
        </view>
      </view>

      <view class="privacy-card">
        <text class="privacy-card__title">请妥善保管备份文件</text>
        <text>备份未加密，可能包含演出地点、座位、备注和票根，仅支持记录现场 Android 本机备份格式</text>
      </view>

      <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>
      <text v-if="busyLabel" class="busy-label">{{ busyLabel }}</text>
    </scroll-view>
  </view>
</template>

<style scoped>
.backup-screen { min-height: 100vh; background: var(--color-background); color: var(--color-text); }
.backup-content { box-sizing: border-box; height: calc(100vh - var(--app-header-height)); padding: 30rpx 30rpx calc(70rpx + env(safe-area-inset-bottom)); }
.preview-notice { margin-bottom: 24rpx; padding: 18rpx 22rpx; border-radius: 16rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 23rpx; line-height: 1.55; }
.summary-card, .preview-card, .recovery-card, .privacy-card { padding: 30rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 24rpx; background: var(--color-surface); }
.summary-card__heading { display: flex; align-items: center; justify-content: space-between; }
.summary-card__title, .preview-card__title, .recovery-card__title, .privacy-card__title { display: block; font-size: 30rpx; font-weight: 650; }
.summary-card__status { padding: 6rpx 14rpx; border-radius: 999rpx; background: var(--color-accent-soft); color: var(--color-accent); font-size: 20rpx; }
.summary-grid { display: grid; margin-top: 30rpx; grid-template-columns: repeat(3, 1fr); }
.summary-grid > view { display: flex; flex-direction: column; gap: 6rpx; }
.summary-grid__value { font-size: 32rpx; font-weight: 650; }
.summary-grid__label, .last-backup, .preview-card__meta, .recovery-card__description, .privacy-card text:last-child { color: var(--color-muted); font-size: 22rpx; line-height: 1.55; }
.last-backup { display: block; margin-top: 28rpx; padding-top: 22rpx; border-top: var(--app-border-width) solid var(--color-border-subtle); }
.action-section { display: grid; margin: 26rpx 0; gap: 16rpx; }
.action-section button, .confirm-action { height: 88rpx; margin: 0; border-radius: 18rpx; font-size: 27rpx; font-weight: 650; line-height: 88rpx; }
.primary-action, .confirm-action { border: 0; background: var(--color-accent); color: var(--color-on-accent); }
.secondary-action { border: var(--app-border-width) solid var(--color-accent); background: transparent; color: var(--color-accent); }
.section-eyebrow { display: block; margin-bottom: 8rpx; color: #2c7a45; font-size: 21rpx; font-weight: 650; }
.preview-card__meta { display: block; margin-top: 10rpx; }
.mode-selector { display: grid; margin-top: 26rpx; gap: 14rpx; }
.mode-option { display: flex; min-height: 98rpx; margin: 0; padding: 18rpx 22rpx; align-items: flex-start; flex-direction: column; justify-content: center; border: var(--app-border-width) solid var(--color-border); border-radius: 17rpx; background: transparent; color: var(--color-muted); text-align: left; font-size: 22rpx; line-height: 1.4; }
.mode-option--active { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-text); }
.mode-option--danger { border-color: #b3261e; background: rgba(179, 38, 30, 0.08); }
.mode-option__title { color: var(--color-text); font-size: 26rpx; font-weight: 650; }
.plan-summary { display: grid; margin-top: 24rpx; grid-template-columns: 1fr 1fr; gap: 12rpx; color: var(--color-muted); font-size: 22rpx; }
.replace-warning { margin-top: 24rpx; padding: 18rpx; border-radius: 14rpx; background: rgba(179, 38, 30, 0.09); color: #b3261e; font-size: 23rpx; line-height: 1.5; }
.plan-warning { display: block; margin-top: 12rpx; color: #9a5a12; font-size: 22rpx; }
.confirm-action { width: 100%; margin-top: 28rpx; }
.confirm-action--danger { background: #b3261e; }
.cancel-action { width: 100%; height: 72rpx; margin: 8rpx 0 0; border: 0; background: transparent; color: var(--color-muted); font-size: 23rpx; line-height: 72rpx; }
.recovery-card, .privacy-card { margin-top: 26rpx; }
.recovery-card__description, .privacy-card text:last-child { display: block; margin-top: 10rpx; }
.recovery-card__actions { display: flex; margin-top: 20rpx; gap: 14rpx; }
.recovery-card__actions button { height: 68rpx; margin: 0; padding: 0 22rpx; border: var(--app-border-width) solid var(--color-border); border-radius: 14rpx; background: transparent; color: var(--color-accent); font-size: 22rpx; line-height: 68rpx; }
.recovery-card__actions .danger-link { color: #b3261e; }
.error-message { display: block; margin-top: 20rpx; color: #b3261e; font-size: 22rpx; }
.busy-label { display: block; margin-top: 16rpx; color: var(--color-muted); text-align: center; font-size: 22rpx; }
</style>
