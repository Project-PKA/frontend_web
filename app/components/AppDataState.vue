<script setup lang="ts">
import AppState from './AppState.vue';

export interface DataStateLabels {
  loading: string;
  emptyTitle: string;
  emptyText?: string;
  errorTitle: string;
  errorText?: string;
  /** "Try again". */
  retry?: string;
}

defineProps<{
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  /** The texts of the three states, already translated. */
  labels: DataStateLabels;
}>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <AppState v-if="loading" kind="loading" :title="labels.loading" />
  <AppState
    v-else-if="error"
    kind="error"
    :title="labels.errorTitle"
    :text="labels.errorText"
    :action-label="labels.retry"
    @action="emit('retry')"
  />
  <AppState v-else-if="empty" kind="empty" :title="labels.emptyTitle" :text="labels.emptyText" />
  <slot v-else />
</template>
