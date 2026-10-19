<script setup lang="ts">
import type { CardItem } from '../api/inventory';
import { cardTitle } from '../utils/inventory';
import AppCombobox from './AppCombobox.vue';

/**
 * Search of the store's cards, as you type: the combobox with what a card looks like in the list
 * (the #ID, the name and the condition).
 */
defineProps<{
  results: CardItem[];
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

const emit = defineEmits<{ select: [card: CardItem]; retry: [] }>();
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
      <span class="id-chip">#{{ item.short_code }}</span>
      <b>{{ cardTitle(item.catalog) }}</b>
      <small>{{ item.condition }}</small>
    </template>
  </AppCombobox>
</template>
