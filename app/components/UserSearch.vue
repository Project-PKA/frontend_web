<script setup lang="ts">
import type { AdminUser } from '../api/admin';
import AppCombobox from './AppCombobox.vue';

/** Search of the active accounts of the platform, as you type: name and e-mail of each. */
defineProps<{
  results: AdminUser[];
  loading?: boolean;
  error?: boolean;
  labels: {
    label: string;
    hint: string;
    loading: string;
    none: string;
    error: string;
    retry: string;
    count: string;
  };
}>();

const emit = defineEmits<{ select: [user: AdminUser]; retry: [] }>();
const query = defineModel<string>('query', { default: '' });
</script>

<template>
  <AppCombobox
    v-model:query="query"
    :results="results"
    :loading="loading"
    :error="error"
    :labels="labels"
    @select="emit('select', $event)"
    @retry="emit('retry')"
  >
    <template #option="{ item }">
      <b>{{ item.name || item.email }}</b>
      <small v-if="item.name">{{ item.email }}</small>
    </template>
  </AppCombobox>
</template>
