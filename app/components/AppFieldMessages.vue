<script setup lang="ts">
/** The hint and the error message under a form control (see `fieldIds`). */
defineProps<{
  hint?: string;
  error?: string | null;
  hintId: string;
  errorId: string;
}>();
</script>

<template>
  <p v-if="hint" :id="hintId" class="hint">{{ hint }}</p>
  <p v-if="error" :id="errorId" class="hint hint--error">{{ error }}</p>
</template>
