<script setup lang="ts">
withDefaults(defineProps<{
  kind: 'records' | 'want-see' | 'imprints'
  theme?: 'light' | 'dark'
}>(), {
  theme: 'light',
})
</script>

<template>
  <view
    class="illustration"
    :class="[`illustration--${kind}`, `illustration--${theme}`]"
    aria-hidden="true"
  />
</template>

<style scoped>
.illustration {
  display: flex;
  width: 460rpx;
  max-width: 72vw;
  aspect-ratio: 260 / 220;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.illustration--records.illustration--light { background-image: url('/static/illustrations/empty-records-light.svg'); }
.illustration--records.illustration--dark { background-image: url('/static/illustrations/empty-records-dark.svg'); }
.illustration--want-see.illustration--light { background-image: url('/static/illustrations/empty-want-see-light.svg'); }
.illustration--want-see.illustration--dark { background-image: url('/static/illustrations/empty-want-see-dark.svg'); }
.illustration--imprints.illustration--light { background-image: url('/static/illustrations/empty-imprints-light.svg'); }
.illustration--imprints.illustration--dark { background-image: url('/static/illustrations/empty-imprints-dark.svg'); }
</style>
