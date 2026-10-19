<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: number;
  max: number;
  /** Accessible name, e.g. "Store setup". */
  label: string;
  /** Spoken instead of the bare number, e.g. "1 of 4 done". */
  valueText?: string;
}>();

const percent = computed(() =>
  props.max > 0 ? Math.min(100, Math.max(0, Math.round((props.value / props.max) * 100))) : 0,
);
</script>

<template>
  <div
    class="progress"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="value"
    :aria-valuetext="valueText"
  >
    <span :style="{ width: `${percent}%` }" />
  </div>
</template>
