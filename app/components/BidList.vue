<script setup lang="ts">
/** The bids of an auction, the highest first, as the design lists them: time, phone and amount. */
defineProps<{
  rows: { id: string; time: string; phone: string; amount: string }[];
  /** Names the list for screen readers, e.g. "Bids received from WhatsApp". */
  label: string;
  /** Shown when there is no bid yet. */
  empty: string;
}>();
</script>

<template>
  <p v-if="rows.length === 0" class="muted bidlist__empty">{{ empty }}</p>
  <ul v-else class="bidlist" :aria-label="label">
    <li v-for="row in rows" :key="row.id" class="bid">
      <span class="mono faint">{{ row.time }}</span>
      <span class="mono">{{ row.phone }}</span>
      <b>{{ row.amount }}</b>
    </li>
  </ul>
</template>
