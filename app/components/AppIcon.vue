<script setup lang="ts">
/** An icon from the design system sprite (`public/icons.svg`). Decorative: label the control. */
defineProps<{ name: string }>();
</script>

<template>
  <svg class="i" aria-hidden="true" focusable="false">
    <use :href="`/icons.svg#i-${name}`" />
  </svg>
</template>
