<script setup lang="ts">
/** The `#ID` of a card, as a button that copies it. The page does the copying and says so. */
defineProps<{
  /** The code without the `#`, as the API sends it. */
  code: string;
  /** Accessible name, already translated, e.g. "Copy #0412". */
  label: string;
}>();

const emit = defineEmits<{ copy: [code: string] }>();
</script>

<template>
  <button
    type="button"
    class="id-chip id-chip--button"
    :aria-label="label"
    @click="emit('copy', code)"
  >
    #{{ code }}
  </button>
</template>
