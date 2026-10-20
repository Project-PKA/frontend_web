<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import {
  SHIPMENT_STATUSES,
  createShipmentsApi,
  type Shipment,
  type ShipmentStatus,
} from '../../api/shipments';
import type { TableColumn } from '../../components/AppTable.vue';
import { useCursorList } from '../../utils/cursor-list';
import { formatStoredPhone } from '../../utils/phone';
import {
  destination,
  notifyUrl,
  parseShipmentStatus,
  toShippedChanges,
} from '../../utils/shipments';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.shipments',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

const TONES = { TO_SHIP: 'warning', SHIPPED: 'info', DELIVERED: 'success' } as const;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createShipmentsApi(useApi());

// The filter lives in the address (`/shipments?status=SHIPPED`): a reload or a shared link keeps it.
const status = ref<string>(parseShipmentStatus(route.query) ?? '');
const filter = computed(() => parseShipmentStatus({ status: status.value }));
watch(filter, (next) => void router.replace({ query: next ? { status: next } : {} }));

const list = useCursorList<Shipment>({
  queryKey: () => ['shipments', access.storeId, filter.value ?? 'all'],
  fetchPage: (cursor, signal) => api.list(filter.value, cursor, signal),
});

const columns = computed<TableColumn[]>(() => [
  { key: 'customer', label: t('shipments.columns.customer') },
  { key: 'destination', label: t('shipments.columns.destination') },
  { key: 'status', label: t('shipments.columns.status') },
  { key: 'tracking', label: t('shipments.columns.tracking') },
  { key: 'action', label: '' },
]);

const rows = computed(() =>
  list.items.value.map((item) => ({
    id: item.id,
    customerId: item.recipient.id,
    name: item.recipient.name,
    phone: item.recipient.phone,
    place: destination(item.recipient.address),
    status: item.status,
    tracking: item.tracking_code ?? '',
  })),
);
type Row = (typeof rows.value)[number];

// ---- The tracking code typed for each shipment that is still to ship
const codes = reactive<Record<string, string>>({});
const busy = ref<string | null>(null);

async function change(row: Row, changes: Parameters<typeof api.update>[1]) {
  busy.value = row.id;
  try {
    await api.update(row.id, changes);
    await queryClient.invalidateQueries({ queryKey: ['shipments'] });
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    busy.value = null;
  }
}

const markShipped = (row: Row) => change(row, toShippedChanges(codes[row.id] ?? ''));
const markDelivered = (row: Row) => change(row, { status: 'DELIVERED' });

function notify(row: Row): string {
  const message = row.tracking
    ? t('shipments.notify.withCode', { name: row.name, code: row.tracking })
    : t('shipments.notify.withoutCode', { name: row.name });
  return notifyUrl(row.phone, message);
}
</script>

<template>
  <div class="stack">
    <div class="filters" role="search">
      <select v-model="status" class="select" :aria-label="t('shipments.filters.status')">
        <option value="">{{ t('shipments.filters.all') }}</option>
        <option v-for="item in SHIPMENT_STATUSES" :key="item" :value="item">
          {{ t(`shipments.status.${item}`) }}
        </option>
      </select>
    </div>

    <AppCard as="section" :aria-label="t('shipments.caption')">
      <AppDataState
        :loading="list.isLoading.value"
        :error="list.isError.value"
        :empty="rows.length === 0"
        :labels="{
          loading: t('shipments.loading'),
          emptyTitle: t('shipments.empty.title'),
          emptyText: t('shipments.empty.text'),
          errorTitle: t('shipments.error'),
          retry: t('shipments.retry'),
        }"
        @retry="list.refetch()"
      >
        <AppTable
          :caption="t('shipments.caption')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: Row) => row.id"
        >
          <template #cell-customer="{ row }">
            <NuxtLink :to="`/customers/${row.customerId}`">{{ row.name }}</NuxtLink>
            <span class="faint mono shipments__phone">{{ formatStoredPhone(row.phone) }}</span>
          </template>
          <template #cell-destination="{ row }">
            <span v-if="row.place">{{ row.place }}</span>
            <span v-else class="faint">—</span>
          </template>
          <template #cell-status="{ row }">
            <AppBadge :tone="TONES[row.status as ShipmentStatus]">
              {{ t(`shipments.status.${row.status}`) }}
            </AppBadge>
          </template>
          <template #cell-tracking="{ row }">
            <input
              v-if="row.status === 'TO_SHIP'"
              v-model="codes[row.id]"
              class="input shipments__code"
              maxlength="60"
              :placeholder="t('shipments.trackingPlaceholder')"
              :aria-label="t('shipments.trackingFor', { name: row.name })"
            />
            <span v-else-if="row.tracking" class="mono">{{ row.tracking }}</span>
            <span v-else class="faint">—</span>
          </template>
          <template #cell-action="{ row }">
            <AppButton
              v-if="row.status === 'TO_SHIP'"
              variant="primary"
              size="sm"
              :busy="busy === row.id"
              @click="markShipped(row)"
            >
              {{ t('shipments.markShipped') }}
            </AppButton>
            <div v-else-if="row.status === 'SHIPPED'" class="row">
              <a
                class="btn btn--secondary btn--sm"
                :href="notify(row)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <AppIcon name="message" />
                {{ t('shipments.notify.action') }}
              </a>
              <AppButton size="sm" :busy="busy === row.id" @click="markDelivered(row)">
                {{ t('shipments.markDelivered') }}
              </AppButton>
            </div>
          </template>
        </AppTable>
        <div v-if="list.hasNextPage.value" class="row customers__more card__foot">
          <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
            {{ t('shipments.loadMore') }}
          </AppButton>
        </div>
        <div class="card__foot">{{ t('shipments.note') }}</div>
      </AppDataState>
    </AppCard>
  </div>
</template>
