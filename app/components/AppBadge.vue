<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'dashed';
    /** A pulsing dot, for "live" states. */
    live?: boolean;
  }>(),
  { tone: 'primary' },
);
</script>

<template>
  <span :class="['badge', `badge--${tone}`, live && 'badge--live']">
    <slot />
  </span>
</template>
