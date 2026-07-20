<script setup lang="ts">
defineProps<{
  name:
    | 'ticket'
    | 'bookmark'
    | 'calendar'
    | 'settings'
    | 'search'
    | 'plus'
    | 'sun'
    | 'droplet'
    | 'folder'
    | 'tag'
    | 'backup'
    | 'info'
    | 'award'
    | 'chevron'
    | 'arrow-left'
    | 'edit'
    | 'trash'
    | 'check'
    | 'close'
    | 'image'
    | 'location'
    | 'seat'
    | 'filter'
    | 'grid'
    | 'list'
}>()
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'ticket'">
      <path d="M4 6.5h16v3a2.5 2.5 0 0 0 0 5v3H4v-3a2.5 2.5 0 0 0 0-5v-3Z" />
      <path d="M10.5 9.2v5.1a1.55 1.55 0 1 1-1.2-1.5 1.65 1.65 0 0 1 1.2.2" />
      <path d="m10.5 9.2 3.5-.8v4.6a1.55 1.55 0 1 1-1.2-1.5 1.65 1.65 0 0 1 1.2.2" />
    </template>

    <template v-else-if="name === 'bookmark'">
      <path d="M6.5 4.5h11v15l-5.5-3.7-5.5 3.7v-15Z" />
    </template>

    <template v-else-if="name === 'calendar'">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.8v3.4M16 3.8v3.4M4 9.5h16" />
      <circle cx="12" cy="14.2" r="1.2" />
    </template>

    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.2 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-2.6-1.5L13.9 2h-3.8l-.4 3.1a7.8 7.8 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 2.6 1.5l.4 3.1h3.8l.4-3.1a7.8 7.8 0 0 0 2.6-1.5l2.4 1 2-3.4-2.1-1.5Z" />
    </template>

    <template v-else-if="name === 'search'">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>

    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </template>

    <template v-else-if="name === 'droplet'">
      <path d="M12 3.2S6.2 9.4 6.2 14a5.8 5.8 0 0 0 11.6 0C17.8 9.4 12 3.2 12 3.2Z" />
    </template>

    <template v-else-if="name === 'folder'">
      <path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z" />
    </template>

    <template v-else-if="name === 'tag'">
      <path d="M8 3.5h8M8 20.5h8M9.5 2 7 22M17 2l-2.5 20M4 9h16M3 15h16" />
    </template>

    <template v-else-if="name === 'backup'">
      <path d="M6.5 18.5h11a4 4 0 0 0 .8-7.9A6.4 6.4 0 0 0 6 8.7a5 5 0 0 0 .5 9.8Z" />
      <path d="M12 9.5v6M9.7 12l2.3-2.5 2.3 2.5" />
    </template>

    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6M12 7.5h.01" />
    </template>

    <template v-else-if="name === 'award'">
      <circle cx="12" cy="9" r="5" />
      <path d="m8.5 12.7-1 8 4.5-2.5 4.5 2.5-1-8" />
    </template>

    <template v-else-if="name === 'chevron'">
      <path d="m9 5 7 7-7 7" />
    </template>

    <template v-else-if="name === 'arrow-left'">
      <path d="m15 5-7 7 7 7M8 12h11" />
    </template>

    <template v-else-if="name === 'edit'">
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.8 6.2 4 4" />
    </template>

    <template v-else-if="name === 'trash'">
      <path d="M4.5 7h15M9 3.8h6l1 3.2H8l1-3.2ZM7 7l.8 13.2h8.4L17 7M10 10.5v6M14 10.5v6" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </template>

    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>

    <template v-else-if="name === 'image'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4.5 17 4.2-4.2 3.1 3.1 2.4-2.4 5.3 5.3" />
    </template>

    <template v-else-if="name === 'location'">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </template>

    <template v-else-if="name === 'seat'">
      <path d="M6 11V7a2 2 0 0 1 4 0v4M14 11V7a2 2 0 0 1 4 0v4" />
      <path d="M4 11h16v6H4zM6 17v3M18 17v3" />
    </template>

    <template v-else-if="name === 'filter'">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </template>

    <template v-else-if="name === 'grid'">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </template>

    <template v-else-if="name === 'list'">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
