<script setup lang="ts">
import { computed } from 'vue'

import type { Performance } from '@/domain/performance'
import {
  artistIntensityLevel,
  computePlaySummary,
} from '@/features/performances/artist-summary'
import type { ArtistSortMode } from '@/features/preferences/model'

const props = defineProps<{
  performances: Performance[]
  sortMode: ArtistSortMode
}>()

const plays = computed(() => computePlaySummary(props.performances, props.sortMode))

defineEmits<{
  select: [name: string]
}>()
</script>

<template>
  <view v-if="plays.length" class="play-summary" aria-label="剧目主题统计">
    <button
      v-for="play in plays"
      :key="play.name"
      class="play-chip"
      :class="`play-chip--level-${artistIntensityLevel(play.times)}`"
      :aria-label="`查看${play.name}的${play.times}场演出统计`"
      hover-class="play-chip--pressed"
      @tap="$emit('select', play.name)"
    >
      <text>{{ play.name }} ✘{{ play.times }}</text>
    </button>
  </view>
  <view v-else class="play-summary-empty">当前演出未填写剧目/主题</view>
</template>

<style scoped>
.play-summary { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8rpx; }
.play-chip { position: relative; overflow: hidden; margin: 0; padding: 9rpx 14rpx; border: 0; border-radius: 16rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 24rpx; font-weight: 620; line-height: 1.3; }
.play-chip::after { border: 0; }
.play-chip::before { position: absolute; z-index: 0; inset: 0; background: var(--color-surface); content: ''; }
.play-chip text { position: relative; z-index: 1; }
.play-chip--pressed { transform: scale(.97); opacity: .82; }
.play-chip--level-0 { background: var(--color-accent-soft); color: var(--color-accent); }
.play-chip--level-0::before, .play-chip--level-4::before { display: none; }
.play-chip--level-1::before { opacity: .35; }
.play-chip--level-2::before { opacity: .22; }
.play-chip--level-3::before { opacity: .1; }
.play-summary-empty { padding: 70rpx 0; color: var(--color-muted); font-size: 25rpx; text-align: center; }
</style>
