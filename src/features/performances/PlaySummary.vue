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
  <view v-if="plays.length" class="play-summary app-chip-list" aria-label="剧目主题统计">
    <button
      v-for="play in plays"
      :key="play.name"
      class="play-chip app-chip"
      :class="`app-chip--level-${artistIntensityLevel(play.times)}`"
      :aria-label="`查看${play.name}的${play.times}场演出统计`"
      hover-class="app-chip--pressed"
      @tap="$emit('select', play.name)"
    >
      <text>{{ play.name }} ✘{{ play.times }}</text>
    </button>
  </view>
  <view v-else class="play-summary-empty">当前演出未填写剧目/主题</view>
</template>

<style scoped>
.play-summary-empty { padding: 70rpx 0; color: var(--color-muted); font-size: 25rpx; text-align: center; }
</style>
