<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Performance } from '@/domain/performance'
import ImprintMonthView from '@/features/imprints/ImprintMonthView.vue'
import { ImprintQueryService } from '@/features/imprints/model'
import { getAppRepositories } from '@/platform/repositories/context'

type ImprintSection = 'month' | 'year' | 'ranks'

const props = defineProps<{
  theme: 'light' | 'dark'
  refreshKey: number
}>()

const emit = defineEmits<{
  add: [startedAtMs: number]
  open: [id: string]
}>()

const activeSection = ref<ImprintSection>('month')
const performances = ref<Performance[]>([])
const loading = ref(true)
let requestSequence = 0

onMounted(load)
watch(() => props.refreshKey, load)

async function load(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const repositories = await getAppRepositories()
    const snapshot = await new ImprintQueryService(repositories.performances).loadSnapshot()
    if (sequence !== requestSequence) return
    performances.value = snapshot.performances
  } catch (error) {
    if (sequence !== requestSequence) return
    uni.showToast({
      title: error instanceof Error ? error.message : '加载印记失败',
      icon: 'none',
    })
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}
</script>

<template>
  <view class="imprints-screen">
    <AppHeader title="印记">
      <template #center>
        <view class="imprints-tabs" aria-label="印记视图">
          <button
            class="imprints-tab"
            :class="{ 'imprints-tab--active': activeSection === 'month' }"
            aria-label="月视图"
            @tap="activeSection = 'month'"
          >月</button>
          <button
            class="imprints-tab"
            :class="{ 'imprints-tab--active': activeSection === 'year' }"
            aria-label="年视图"
            @tap="activeSection = 'year'"
          >年</button>
          <button
            class="imprints-tab imprints-tab--wide"
            :class="{ 'imprints-tab--active': activeSection === 'ranks' }"
            aria-label="榜榜榜视图"
            @tap="activeSection = 'ranks'"
          >榜榜榜</button>
        </view>
      </template>
    </AppHeader>

    <view v-if="loading" class="loading-state">正在整理演出印记…</view>
    <ImprintMonthView
      v-else-if="activeSection === 'month'"
      :performances="performances"
      @add="$emit('add', $event)"
      @open="$emit('open', $event)"
    />
    <view v-else class="section-placeholder">
      <view class="section-placeholder__icon"><AppIcon :name="activeSection === 'year' ? 'calendar' : 'award'" /></view>
      <text class="section-placeholder__title">{{ activeSection === 'year' ? '年' : '榜榜榜' }}</text>
      <text class="section-placeholder__description">本轮先完成月视图，这部分将在下一轮按 iOS 页面继续还原</text>
    </view>
  </view>
</template>

<style scoped>
.imprints-screen { min-height: 100vh; background: var(--color-background); }
.imprints-tabs { display: grid; width: 100%; height: 64rpx; padding: 4rpx; grid-template-columns: 1fr 1fr 1.6fr; border: var(--app-border-width) solid var(--color-border); border-radius: 16rpx; background: var(--color-surface); }
.imprints-tab { height: 54rpx; margin: 0; padding: 0 12rpx; border: 0; border-radius: 12rpx; background: transparent; color: var(--color-muted); font-size: 23rpx; font-weight: 620; line-height: 54rpx; white-space: nowrap; }
.imprints-tab::after { border: 0; }
.imprints-tab--active { background: var(--color-accent); color: var(--color-on-accent); box-shadow: 0 4rpx 10rpx var(--color-tab-shadow); }
.loading-state { display: flex; min-height: calc(100vh - var(--app-header-height) - 132rpx); align-items: center; justify-content: center; color: var(--color-muted); font-size: 26rpx; }
.section-placeholder { display: flex; height: calc(100vh - var(--app-header-height) - 132rpx - env(safe-area-inset-bottom)); padding: 40rpx; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.section-placeholder__icon { width: 72rpx; height: 72rpx; color: var(--color-accent); opacity: .68; }
.section-placeholder__title { margin-top: 24rpx; color: var(--color-text); font-size: 34rpx; font-weight: 720; }
.section-placeholder__description { max-width: 520rpx; margin-top: 13rpx; color: var(--color-muted); font-size: 23rpx; line-height: 1.55; }
</style>
