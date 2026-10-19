<script setup lang="ts">
import type { TableColumn } from './AppTable.vue';
import { cardRows } from '../utils/home';

/** The cards that have no auction scheduled, the oldest first. */
const { t } = useI18n();
const access = useAccessStore();
const cards = useHomeData((home) => cardRows(home.cards_without_auction));

const columns = computed<TableColumn[]>(() => [
  { key: 'shortCode', label: t('home.columns.id') },
  { key: 'name', label: t('home.columns.card') },
]);
</script>

<template>
  <AppCard
    v-if="cards.data.value?.length"
    id="no-auction"
    as="section"
    :title="t('home.noAuction.title')"
  >
    <template v-if="access.can('can_manage_inventory')" #head>
      <NuxtLink to="/inventory">{{ t('home.noAuction.seeStock') }}</NuxtLink>
    </template>
    <AppTable
      :caption="t('home.noAuction.title')"
      :columns="columns"
      :rows="cards.data.value"
      :row-key="(row) => row.id"
    >
      <template #cell-shortCode="{ row }">
        <span class="id-chip">#{{ row.shortCode }}</span>
      </template>
    </AppTable>
    <template #foot>{{ t('home.noAuction.foot') }}</template>
  </AppCard>
</template>
