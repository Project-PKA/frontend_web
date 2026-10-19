<script setup lang="ts">
import type { CatalogCard } from '../api/catalog';
import { artUrl } from '../utils/catalog';
import AppCombobox from './AppCombobox.vue';

/**
 * Search of the card catalog, as you type: the combobox with what a card looks like in the list
 * (the art, the name, the set and the number). The page asks the API and owns the text.
 */
defineProps<{
  results: CatalogCard[];
  /** The first answer for this text has not come yet. */
  loading?: boolean;
  error?: boolean;
  labels: {
    label: string;
    /** "Type at least 2 characters." */
    hint: string;
    loading: string;
    /** "No card found for pika." (already with the text in it) */
    none: string;
    error: string;
    retry: string;
    /** "3 cards found", for screen readers. */
    count: string;
  };
}>();

const emit = defineEmits<{ select: [card: CatalogCard]; retry: [] }>();
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
      <span class="tcg tcg--xs" aria-hidden="true">
        <img
          v-if="artUrl(item.image_url)"
          :src="artUrl(item.image_url) ?? undefined"
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        />
      </span>
      <b>{{ item.name }}</b>
      <span class="muted">{{ item.set_name }}</span>
      <small>{{ item.number }}</small>
    </template>
  </AppCombobox>
</template>
