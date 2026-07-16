<script setup lang="ts">
withDefaults(defineProps<{
  kind: 'records' | 'want-see' | 'imprints'
  theme?: 'light' | 'dark'
}>(), {
  theme: 'light',
})
</script>

<template>
  <view class="illustration" :class="`illustration--${kind}`" aria-hidden="true">
    <template v-if="kind === 'records'">
      <svg
        v-show="theme === 'light'"
        class="records-light-art"
        viewBox="0 0 260 220"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <ellipse class="illustration__shadow" cx="130" cy="202" rx="77" ry="8" />
        <path class="illustration__wash" d="M132 32c37-9 72 5 79 37 8 35-13 75-56 106l-27-18c-29-20-45-45-43-70 2-27 19-47 47-55Z" />
        <path class="illustration__line" d="M132 32c37-9 72 5 79 37 8 35-13 75-56 106l-27-18c-29-20-45-45-43-70 2-27 19-47 47-55Z" />
        <path class="illustration__accent-fill" d="M137 75v45.5a14 14 0 1 1-9-13V68l37-8v42.5a14 14 0 1 1-9-13V64" />
        <path class="illustration__paper" d="M38 130h126v20a18 18 0 0 0 0 36v15H38v-15a18 18 0 0 0 0-36v-20Z" />
        <path class="illustration__line" d="M38 130h126v20a18 18 0 0 0 0 36v15H38v-15a18 18 0 0 0 0-36v-20Z" />
        <path class="illustration__detail" d="M74 131v69M101 151l5 10 11 1-8 8 2 11-10-5-10 5 2-11-8-8 11-1 5-10ZM125 157h22M125 173h16" />
        <path class="illustration__spark" d="m54 77 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9ZM219 120v12M213 126h12" />
        <circle class="illustration__dot" cx="35" cy="119" r="4" />
        <circle class="illustration__dot" cx="219" cy="171" r="5" />
      </svg>

      <svg
        v-show="theme === 'dark'"
        class="records-dark-art"
        viewBox="0 0 260 220"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path class="illustration__dark-pick-wash" d="M130 25c48 0 86 23 89 60 4 45-31 88-89 116-58-28-93-71-89-116 3-37 41-60 89-60Z" />
        <path class="illustration__accent-detail illustration__dark-pick" d="M130 25c48 0 86 23 89 60 4 45-31 88-89 116-58-28-93-71-89-116 3-37 41-60 89-60Z" />
        <path class="illustration__dark-dash" d="M130 37c40 0 74 19 77 50 3 38-28 76-77 101-49-25-80-63-77-101 3-31 37-50 77-50Z" />
        <path class="illustration__accent-fill" d="M137 72v58a17 17 0 1 1-11-16V64l41-9v51a17 17 0 1 1-11-16V59" />
        <path class="illustration__detail" d="M68 76 57 65M53 109H37M76 161l-12 12M192 76l11-11M207 109h16M184 161l12 12" />
        <path class="illustration__spark" d="m211 156 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />
        <circle class="illustration__dot" cx="37" cy="143" r="3" />
        <circle class="illustration__dot" cx="223" cy="139" r="3" />
      </svg>
    </template>

    <svg
      v-else-if="kind === 'want-see'"
      viewBox="0 0 260 220"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <ellipse class="illustration__shadow" cx="132" cy="199" rx="86" ry="8" />
      <path class="illustration__paper" d="M72 55h137a8 8 0 0 1 8 8v119H64V63a8 8 0 0 1 8-8Z" />
      <path class="illustration__line" d="M72 55h137a8 8 0 0 1 8 8v119H64V63a8 8 0 0 1 8-8ZM86 43v24M118 43v24M150 43v24M182 43v24M80 84h120" />
      <path class="illustration__grid" d="M89 104h18v15H89zM118 104h18v15h-18zM147 104h18v15h-18zM176 104h18v15h-18zM89 129h18v15H89zM118 129h18v15h-18zM147 129h18v15h-18z" />
      <path class="illustration__accent-detail" d="M176 129h18v15h-18z" />
      <path class="illustration__paper" d="M28 134h122v15a16 16 0 0 0 0 32v16H28v-16a16 16 0 0 0 0-32v-15Z" />
      <path class="illustration__line" d="M28 134h122v15a16 16 0 0 0 0 32v16H28v-16a16 16 0 0 0 0-32v-15Z" />
      <path class="illustration__accent-detail" d="M79 151v26a8 8 0 1 1-6-7.8V148l21-5v24a8 8 0 1 1-6-7.8v-14.7" />
      <path class="illustration__detail" d="M105 157h26M105 170h18" />
    </svg>

    <svg
      v-else
      viewBox="0 0 260 220"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path class="illustration__wash" d="M55 38c44-28 112-19 148 23 34 40 33 99-4 130-37 31-104 30-143-3-42-36-47-119-1-150Z" />
      <path class="illustration__paper" d="M55 61h150a10 10 0 0 1 10 10v121H45V71a10 10 0 0 1 10-10Z" />
      <path class="illustration__line" d="M55 61h150a10 10 0 0 1 10 10v121H45V71a10 10 0 0 1 10-10ZM45 94h170M78 43v35M182 43v35" />
      <path class="illustration__grid-line" d="M78 112v63M113 112v63M148 112v63M183 112v63M61 133h138M61 154h138" />
      <path class="illustration__accent-fill" d="M168 116v25a9 9 0 1 1-6-8.5V112l22-5v23a9 9 0 1 1-6-8.5v-13" />
      <path class="illustration__line" d="m187 192 28-28v18a10 10 0 0 1-10 10h-18Z" />
    </svg>
  </view>
</template>

<style scoped>
.illustration {
  display: flex;
  width: 460rpx;
  max-width: 72vw;
  aspect-ratio: 260 / 220;
  align-items: center;
  justify-content: center;
}

.illustration svg {
  display: block;
  width: 100%;
  height: 100%;
}

.illustration__line {
  stroke: var(--color-illustration-line);
  stroke-width: 2.4;
}

.illustration__detail {
  stroke: var(--color-illustration-detail);
  stroke-width: 2;
}

.illustration__accent-detail {
  stroke: var(--color-accent);
  stroke-width: 2.2;
}

.illustration__accent-fill {
  fill: var(--color-accent);
  stroke: var(--color-accent);
  stroke-width: 1.6;
}

.illustration__paper {
  fill: var(--color-illustration-paper);
}

.illustration__wash {
  fill: var(--color-accent-soft);
}

.illustration__shadow {
  fill: var(--color-illustration-shadow);
}

.illustration__dot {
  fill: var(--color-illustration-dot);
}

.illustration__spark {
  stroke: var(--color-accent);
  stroke-width: 2;
}

.illustration__grid {
  fill: var(--color-illustration-grid);
}

.illustration__grid-line {
  stroke: var(--color-illustration-grid-line);
  stroke-width: 1.4;
}

.illustration__dark-pick-wash {
  fill: var(--color-accent-soft);
  opacity: 0.55;
}

.illustration__dark-pick {
  stroke-width: 2.6;
}

.illustration__dark-dash {
  stroke: var(--color-accent);
  stroke-width: 1.3;
  stroke-dasharray: 6 7;
  opacity: 0.75;
}
</style>
