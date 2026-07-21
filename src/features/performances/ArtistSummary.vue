<script setup lang="ts">
import { computed } from 'vue'

import type { Performance } from '@/domain/performance'
import {
  artistIntensityLevel,
  computeArtistSummary,
} from '@/features/performances/artist-summary'
import type { ArtistSortMode } from '@/features/preferences/model'

const props = defineProps<{
  performances: Performance[]
  sortMode: ArtistSortMode
}>()

const artists = computed(() => computeArtistSummary(props.performances, props.sortMode))

defineEmits<{
  select: [name: string]
}>()
</script>

<template>
  <view v-if="artists.length" class="artist-summary" aria-label="阵容统计">
    <button
      v-for="artist in artists"
      :key="artist.name"
      class="artist-chip"
      :class="`artist-chip--level-${artistIntensityLevel(artist.times)}`"
      :aria-label="`查看${artist.name}的${artist.times}场演出统计`"
      hover-class="artist-chip--pressed"
      @tap="$emit('select', artist.name)"
    >
      <text>{{ artist.name }} ✘{{ artist.times }}</text>
    </button>
  </view>
  <view v-else class="artist-summary-empty">当前演出未填写阵容</view>
</template>

<style scoped>
.artist-summary { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8rpx; }
.artist-chip { position: relative; overflow: hidden; margin: 0; padding: 9rpx 14rpx; border: 0; border-radius: 16rpx; background: var(--color-accent); color: var(--color-on-accent); font-size: 24rpx; font-weight: 620; line-height: 1.3; }
.artist-chip::after { border: 0; }
.artist-chip::before { position: absolute; z-index: 0; inset: 0; background: var(--color-surface); content: ''; }
.artist-chip text { position: relative; z-index: 1; }
.artist-chip--pressed { transform: scale(.97); opacity: .82; }
.artist-chip--level-0 { background: var(--color-accent-soft); color: var(--color-accent); }
.artist-chip--level-0::before, .artist-chip--level-4::before { display: none; }
.artist-chip--level-1::before { opacity: .35; }
.artist-chip--level-2::before { opacity: .22; }
.artist-chip--level-3::before { opacity: .1; }
.artist-summary-empty { padding: 70rpx 0; color: var(--color-muted); font-size: 25rpx; text-align: center; }
</style>
