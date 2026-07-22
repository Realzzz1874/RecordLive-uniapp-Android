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
    | 'arrow.counterclockwise.square'
    | 'arrow.left.square'
    | 'arrow.right.square'
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
  <view
    class="app-icon"
    :class="`app-icon--${name}`"
    aria-hidden="true"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  width: 100%;
  height: 100%;
  background-color: currentColor;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.app-icon--ticket { -webkit-mask-image: url('/static/icons/ticket.svg'); mask-image: url('/static/icons/ticket.svg'); }
.app-icon--bookmark { -webkit-mask-image: url('/static/icons/bookmark.svg'); mask-image: url('/static/icons/bookmark.svg'); }
.app-icon--calendar { -webkit-mask-image: url('/static/icons/calendar.svg'); mask-image: url('/static/icons/calendar.svg'); }
.app-icon--settings { -webkit-mask-image: url('/static/icons/settings.svg'); mask-image: url('/static/icons/settings.svg'); }
.app-icon--search { -webkit-mask-image: url('/static/icons/search.svg'); mask-image: url('/static/icons/search.svg'); }
.app-icon--plus { -webkit-mask-image: url('/static/icons/plus.svg'); mask-image: url('/static/icons/plus.svg'); }
.app-icon--sun { -webkit-mask-image: url('/static/icons/sun.svg'); mask-image: url('/static/icons/sun.svg'); }
.app-icon--droplet { -webkit-mask-image: url('/static/icons/droplet.svg'); mask-image: url('/static/icons/droplet.svg'); }
.app-icon--folder { -webkit-mask-image: url('/static/icons/folder.svg'); mask-image: url('/static/icons/folder.svg'); }
.app-icon--tag { -webkit-mask-image: url('/static/icons/tag.svg'); mask-image: url('/static/icons/tag.svg'); }
.app-icon--backup { -webkit-mask-image: url('/static/icons/backup.svg'); mask-image: url('/static/icons/backup.svg'); }
.app-icon--info { -webkit-mask-image: url('/static/icons/info.svg'); mask-image: url('/static/icons/info.svg'); }
.app-icon--award { -webkit-mask-image: url('/static/icons/award.svg'); mask-image: url('/static/icons/award.svg'); }
.app-icon--chevron { -webkit-mask-image: url('/static/icons/chevron.svg'); mask-image: url('/static/icons/chevron.svg'); }
.app-icon--arrow-left { -webkit-mask-image: url('/static/icons/arrow-left.svg'); mask-image: url('/static/icons/arrow-left.svg'); }
.app-icon--arrow\.counterclockwise\.square { -webkit-mask-image: url('/static/icons/arrow.counterclockwise.square.svg'); mask-image: url('/static/icons/arrow.counterclockwise.square.svg'); }
.app-icon--arrow\.left\.square { -webkit-mask-image: url('/static/icons/arrow.left.square.svg'); mask-image: url('/static/icons/arrow.left.square.svg'); }
.app-icon--arrow\.right\.square { -webkit-mask-image: url('/static/icons/arrow.right.square.svg'); mask-image: url('/static/icons/arrow.right.square.svg'); }
.app-icon--edit { -webkit-mask-image: url('/static/icons/edit.svg'); mask-image: url('/static/icons/edit.svg'); }
.app-icon--trash { -webkit-mask-image: url('/static/icons/trash.svg'); mask-image: url('/static/icons/trash.svg'); }
.app-icon--check { -webkit-mask-image: url('/static/icons/check.svg'); mask-image: url('/static/icons/check.svg'); }
.app-icon--close { -webkit-mask-image: url('/static/icons/close.svg'); mask-image: url('/static/icons/close.svg'); }
.app-icon--image { -webkit-mask-image: url('/static/icons/image.svg'); mask-image: url('/static/icons/image.svg'); }
.app-icon--location { -webkit-mask-image: url('/static/icons/location.svg'); mask-image: url('/static/icons/location.svg'); }
.app-icon--seat { -webkit-mask-image: url('/static/icons/seat.svg'); mask-image: url('/static/icons/seat.svg'); }
.app-icon--filter { -webkit-mask-image: url('/static/icons/filter.svg'); mask-image: url('/static/icons/filter.svg'); }
.app-icon--grid { -webkit-mask-image: url('/static/icons/grid.svg'); mask-image: url('/static/icons/grid.svg'); }
.app-icon--list { -webkit-mask-image: url('/static/icons/list.svg'); mask-image: url('/static/icons/list.svg'); }
</style>
