<script setup lang="ts">
import { computed } from 'vue';
import { pieSlices } from '../utils/finance';

/** A pie with its legend: the share of each part in the whole, as in the design. */
const props = defineProps<{
  items: { label: string; value: number }[];
  /** What the chart shows, for screen readers. */
  label: string;
}>();

/** The tokens of the design, in the order of the parts; a seventh part repeats the first. */
const COLORS = [
  'var(--primary)',
  'var(--success)',
  'var(--info)',
  'var(--warning)',
  'var(--danger)',
  'var(--text-3)',
];
const SIZE = 140;
const RADIUS = 66;

const color = (index: number) => COLORS[index % COLORS.length]!;
const slices = computed(() => {
  const drawn = pieSlices(
    props.items.map((item) => item.value),
    RADIUS,
    SIZE / 2,
  );
  // The wedges skip the parts at zero, the legend keeps them: match the two by position.
  let next = 0;
  return props.items.map((item, index) => ({
    label: item.label,
    color: color(index),
    slice: item.value > 0 ? drawn[next++] : undefined,
  }));
});
</script>

<template>
  <div class="pie-wrap">
    <svg
      :viewBox="`0 0 ${SIZE} ${SIZE}`"
      :width="SIZE"
      :height="SIZE"
      role="img"
      :aria-label="label"
    >
      <template v-for="part in slices" :key="part.label">
        <circle
          v-if="part.slice && part.slice.path === null"
          :cx="SIZE / 2"
          :cy="SIZE / 2"
          :r="RADIUS"
          :fill="part.color"
        />
        <path
          v-else-if="part.slice"
          :d="part.slice.path ?? ''"
          :fill="part.color"
          stroke="var(--surface)"
          stroke-width="2"
        />
      </template>
    </svg>
    <div class="legend">
      <div v-for="part in slices" :key="part.label" class="legend__row">
        <i class="dot" :style="{ background: part.color }" />{{ part.label }}
        <b>{{ part.slice?.share ?? 0 }}%</b>
      </div>
    </div>
  </div>
</template>
