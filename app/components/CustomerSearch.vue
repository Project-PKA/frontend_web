<script setup lang="ts">
import type { Customer } from '../api/customers';
import AppCombobox from './AppCombobox.vue';

/**
 * Search of the store's customers, as you type: the combobox with what a customer looks like in
 * the list (the name and the masked CPF, or the phone's last digits when there is no CPF).
 */
defineProps<{
  results: Customer[];
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

const emit = defineEmits<{ select: [customer: Customer]; retry: [] }>();
const query = defineModel<string>('query', { default: '' });

/** What tells two people with the same name apart, without showing a whole phone number. */
function detail(customer: Customer): string {
  return customer.cpf_masked ?? `…${customer.phone.slice(-4)}`;
}
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
      <b>{{ item.name }}</b>
      <small>{{ detail(item) }}</small>
    </template>
  </AppCombobox>
</template>
