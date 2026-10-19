<script setup lang="ts">
import AppIcon from './AppIcon.vue';

/** An indicator of the home: icon, value, label, and optionally a badge and a link. */
defineProps<{
  /** Icon of the design sprite, without the `i-` prefix. */
  icon: string;
  value: string | number;
  label: string;
}>();
</script>

<template>
  <div class="card kpi frame">
    <div class="kpi__row">
      <span class="kpi__icon" aria-hidden="true"><AppIcon :name="icon" /></span>
      <slot name="badge" />
    </div>
    <div>
      <div class="kpi__value">{{ value }}</div>
      <div class="kpi__label">{{ label }}</div>
    </div>
    <slot name="link" />
  </div>
</template>
