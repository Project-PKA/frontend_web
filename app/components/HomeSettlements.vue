<script setup lang="ts">
import type { TableColumn } from './AppTable.vue';
import { settlementRows, type SettlementRow } from '../utils/home';

/** The queue of settlements ready to be closed. */
const { t } = useI18n();
const access = useAccessStore();
const format = useFormat();
const settlements = useHomeData((home) => settlementRows(home.quick_settlements));

const columns = computed<TableColumn[]>(() => [
  { key: 'customerName', label: t('home.columns.customer') },
  { key: 'items', label: t('home.columns.items') },
  { key: 'amount', label: t('home.columns.value'), numeric: true },
  { key: 'closed', label: t('home.columns.closed') },
  { key: 'action', label: '' },
]);

// "12 minutes ago" is counted from the moment the data arrived, so it moves with each refresh.
const now = computed(() =>
  settlements.dataUpdatedAt.value > 0 ? settlements.dataUpdatedAt.value : Date.now(),
);

/** What each cell shows (the amount is formatted from its string, never turned into a number). */
function cells(row: SettlementRow) {
  return {
    items: t('home.itemsCount', { count: row.items }, row.items),
    amount: row.totalAmount === null ? '' : format.money(row.totalAmount),
    closed: row.createdAt === null ? '' : format.relative(row.createdAt, now.value),
  };
}
</script>

<template>
  <AppCard
    v-if="settlements.data.value?.length"
    id="settlements"
    as="section"
    :title="t('home.settlements.title')"
  >
    <AppTable
      :caption="t('home.settlements.title')"
      :columns="columns"
      :rows="settlements.data.value"
      :row-key="(row) => row.id"
    >
      <template #cell-items="{ row }">{{ cells(row).items }}</template>
      <template #cell-amount="{ row }">{{ cells(row).amount }}</template>
      <template #cell-closed="{ row }">{{ cells(row).closed }}</template>
      <template #cell-action="{ row }">
        <AppButton
          v-if="access.can('can_manage_customers') && row.customerId"
          size="sm"
          :to="`/customers/${row.customerId}`"
        >
          {{ t('home.settlements.close') }}
        </AppButton>
      </template>
    </AppTable>
  </AppCard>
</template>
