<script setup lang="ts">
import { computed } from 'vue';
import { areaPoints, linePoints, niceMax, ticks, type DayPoint } from '../utils/finance';

/**
 * Revenue (solid) and profit (dashed) per day, drawn in SVG as in the design. The amounts are in
 * cents, only to place the points: the text of the values comes from the API strings elsewhere.
 */
const props = defineProps<{
  days: DayPoint[];
  /** What the chart shows, for screen readers. */
  label: string;
  /** The text of a line of the axis, from an amount in cents. */
  formatTick: (cents: number) => string;
}>();

const BOX = { left: 46, right: 624, top: 14, bottom: 196 };
/** At most this many labels under the axis; the rest would overlap. */
const MAX_LABELS = 7;

const max = computed(() => niceMax(Math.max(0, ...props.days.map((day) => day.revenue))));
const revenue = computed(() =>
  linePoints(
    props.days.map((day) => day.revenue),
    max.value,
    BOX,
  ),
);
const profit = computed(() =>
  linePoints(
    props.days.map((day) => day.profit),
    max.value,
    BOX,
  ),
);
const area = computed(() =>
  areaPoints(
    props.days.map((day) => day.revenue),
    max.value,
    BOX,
  ),
);
const lines = computed(() =>
  ticks(max.value).map((value) => ({
    value,
    y: BOX.bottom - (value / max.value) * (BOX.bottom - BOX.top),
  })),
);
const labels = computed(() => {
  const count = props.days.length;
  const every = Math.max(1, Math.ceil(count / MAX_LABELS));
  const span = BOX.right - BOX.left;
  return props.days
    .map((day, index) => ({
      text: day.label,
      index,
      x: count === 1 ? BOX.left + span / 2 : BOX.left + (span * index) / (count - 1),
    }))
    .filter((item) => item.index % every === 0 || item.index === count - 1);
});
</script>

<template>
  <svg class="chart" viewBox="0 0 640 222" role="img" :aria-label="label">
    <defs>
      <linearGradient id="finance-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--primary)" stop-opacity=".35" />
        <stop offset="1" stop-color="var(--primary)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <template v-for="line in lines" :key="line.value">
      <line class="gl" :x1="BOX.left" :x2="BOX.right" :y1="line.y" :y2="line.y" />
      <text class="ax" :x="BOX.left - 6" :y="line.y + 3" text-anchor="end">
        {{ formatTick(line.value) }}
      </text>
    </template>
    <text
      v-for="item in labels"
      :key="item.index"
      class="ax"
      :x="item.x"
      y="214"
      text-anchor="middle"
    >
      {{ item.text }}
    </text>
    <polygon v-if="area" :points="area" fill="url(#finance-area)" />
    <polyline :points="revenue" fill="none" stroke="var(--primary)" stroke-width="2.2" />
    <polyline
      :points="profit"
      fill="none"
      stroke="var(--info)"
      stroke-width="2"
      stroke-dasharray="5 4"
    />
  </svg>
</template>
