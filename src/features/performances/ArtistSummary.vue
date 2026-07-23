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
  <view v-if="artists.length" class="artist-summary app-chip-list" aria-label="阵容统计">
    <button
      v-for="artist in artists"
      :key="artist.name"
      class="artist-chip app-chip app-intensity-chip"
      :class="`app-intensity-chip--level-${artistIntensityLevel(artist.times)}`"
      :aria-label="`查看${artist.name}的${artist.times}场演出统计`"
      hover-class="app-chip--pressed"
      @tap="$emit('select', artist.name)"
    >
      <text>{{ artist.name }} ✘{{ artist.times }}</text>
    </button>
  </view>
  <view v-else class="artist-summary-empty">当前演出未填写阵容</view>
</template>

<style scoped>
.artist-summary-empty { padding: 70rpx 0; color: var(--color-muted); font-size: 25rpx; text-align: center; }
</style>
