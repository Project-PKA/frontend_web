<script setup lang="ts">
import { computed } from 'vue';
import { niceMax, ticks, type Bar } from '../utils/finance';

/** Vertical bars with the count above each one; the highest is highlighted, as in the design. */
const props = withDefaults(
  defineProps<{
    bars: Bar[];
    /** What the chart shows, for screen readers. */
    label: string;
    /** Show the name of every n-th bar only (the 24 hours would overlap). */
    labelEvery?: number;
  }>(),
  { labelEvery: 1 },
);

const BOX = { left: 30, right: 532, top: 21, bottom: 164 };

const max = computed(() => niceMax(Math.max(0, ...props.bars.map((bar) => bar.value))));
const slot = computed(() => (BOX.right - BOX.left) / Math.max(1, props.bars.length));
const peak = computed(() => Math.max(0, ...props.bars.map((bar) => bar.value)));
const lines = computed(() =>
  ticks(max.value).map((value) => ({
    value: Number.isInteger(value) ? value : Math.round(value * 10) / 10,
    y: BOX.bottom - (value / max.value) * (BOX.bottom - BOX.top),
  })),
);
const drawn = computed(() =>
  props.bars.map((bar, index) => {
    const height = (bar.value / max.value) * (BOX.bottom - BOX.top);
    const width = slot.value * 0.76;
    const x = BOX.left + slot.value * index + (slot.value - width) / 2;
    return {
      ...bar,
      x,
      width,
      y: BOX.bottom - height,
      height,
      center: x + width / 2,
      peak: bar.value > 0 && bar.value === peak.value,
      named: index % props.labelEvery === 0,
    };
  }),
);
</script>

<template>
  <svg class="chart" viewBox="0 0 540 190" role="img" :aria-label="label">
    <template v-for="line in lines" :key="line.y">
      <line class="gl" :x1="BOX.left" :x2="BOX.right" :y1="line.y" :y2="line.y" />
      <text class="ax" :x="BOX.left - 5" :y="line.y + 3" text-anchor="end">{{ line.value }}</text>
    </template>
    <template v-for="bar in drawn" :key="bar.label">
      <rect
        :x="bar.x"
        :y="bar.y"
        :width="bar.width"
        :height="bar.height"
        rx="3"
        :fill="bar.peak ? 'var(--success)' : 'var(--primary)'"
      />
      <text
        v-if="bar.value > 0 && labelEvery === 1"
        class="ax"
        :x="bar.center"
        :y="bar.y - 4"
        text-anchor="middle"
      >
        {{ bar.value }}
      </text>
      <text v-if="bar.named" class="ax" :x="bar.center" y="180" text-anchor="middle">
        {{ bar.label }}
      </text>
    </template>
  </svg>
</template>
