<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  createSettlementsApi,
  type AwaitingBuyer,
  type Settlement,
  type SettlementStatus,
} from '../api/settlements';
import type { TableColumn } from '../components/AppTable.vue';
import { settlementLinkUrl, whatsappUrl } from '../utils/card-form';
import { useCursorList } from '../utils/cursor-list';
import { formatStoredPhone } from '../utils/phone';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'settlements.title',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

const { t } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createSettlementsApi(useApi());

const active = ref('awaiting');
const tabs = computed(() => [
  { id: 'awaiting', label: t('settlements.tabs.awaiting') },
  { id: 'PENDING', label: t('settlements.tabs.pending') },
  { id: 'PAID', label: t('settlements.tabs.paid') },
]);
const canConfirm = computed(() => access.can('can_view_finance'));

const refresh = () =>
  Promise.all(
    ['settlements', 'customer-settlements', 'home', 'inventory'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );

// ---- Buyers waiting for a settlement
const awaiting = useQuery({
  queryKey: computed(() => ['settlements', access.storeId, 'awaiting']),
  queryFn: ({ signal }) => api.awaiting(signal),
  enabled: computed(() => active.value === 'awaiting'),
});
const buyers = computed(() => awaiting.data.value?.items ?? []);

/** The settlement that was just made or whose link was just made: the link shows only once. */
const link = ref<{
  url: string;
  name: string;
  phone: string;
  whatsapp: string;
} | null>(null);
const busyKey = ref<string | null>(null);
const failure = ref<string | null>(null);

async function makeLink(settlement: Pick<Settlement, 'id' | 'customer'>) {
  const { token } = await api.createLink(settlement.id);
  const url = settlementLinkUrl(window.location.origin, token);
  link.value = {
    url,
    name: settlement.customer.name,
    phone: settlement.customer.phone,
    whatsapp: whatsappUrl(
      settlement.customer.phone,
      t('settlements.link.message', { name: settlement.customer.name, link: url }),
    ),
  };
}

async function createFor(buyer: AwaitingBuyer) {
  busyKey.value = buyer.customer.id;
  failure.value = null;
  try {
    const settlement = await api.create(
      buyer.customer.id,
      buyer.items.map((item) => item.auction_id),
    );
    await refresh();
    toast.success(t('settlements.created', { name: buyer.customer.name }));
    await makeLink(settlement);
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busyKey.value = null;
  }
}

async function linkFor(row: Settlement) {
  busyKey.value = row.id;
  failure.value = null;
  try {
    await makeLink(row);
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busyKey.value = null;
  }
}

async function copyLink() {
  if (!link.value) return;
  try {
    await navigator.clipboard.writeText(link.value.url);
    toast.info(t('settlements.link.copied'));
  } catch {
    toast.error(t('settlements.link.copyFailed'));
  }
}

// ---- The settlements already made
function settlementList(status: SettlementStatus) {
  return useCursorList<Settlement>({
    queryKey: () => ['settlements', access.storeId, status],
    fetchPage: (cursor, signal) => api.list(status, cursor, signal),
    enabled: () => active.value === status,
  });
}
const pending = settlementList('PENDING');
const paid = settlementList('PAID');

const columns = computed<TableColumn[]>(() => [
  { key: 'customer', label: t('settlements.columns.customer') },
  { key: 'items', label: t('settlements.columns.items'), numeric: true },
  { key: 'total', label: t('settlements.columns.total'), numeric: true },
  { key: 'status', label: t('settlements.columns.status') },
  { key: 'action', label: '' },
]);

function toRow(item: Settlement) {
  return {
    ...item,
    count: item.items.length,
    total: format.money(item.total_amount),
    phone: formatStoredPhone(item.customer.phone),
    claimed: item.payment_claimed_at ? format.dateTime(item.payment_claimed_at) : null,
    paidAt: item.paid_at ? format.dateTime(item.paid_at) : null,
  };
}
type Row = ReturnType<typeof toRow>;
const pendingRows = computed(() => pending.items.value.map(toRow));
const paidRows = computed(() => paid.items.value.map(toRow));
/** The list of the tab that is open: the open settlements or the paid ones. */
const shown = computed(() =>
  active.value === 'PAID'
    ? {
        rows: paidRows.value,
        query: paid,
        title: 'settlements.tabs.paid',
        empty: 'settlements.paidEmpty',
      }
    : {
        rows: pendingRows.value,
        query: pending,
        title: 'settlements.tabs.pending',
        empty: 'settlements.pendingEmpty',
      },
);

const awaitingColumns = computed<TableColumn[]>(() => [
  { key: 'customer', label: t('settlements.columns.customer') },
  { key: 'cards', label: t('settlements.columns.cards') },
  { key: 'subtotal', label: t('settlements.columns.subtotal'), numeric: true },
  { key: 'action', label: '' },
]);
const awaitingRows = computed(() =>
  buyers.value.map((buyer) => ({
    id: buyer.customer.id,
    buyer,
    name: buyer.customer.name,
    cards: buyer.items.map((item) => `#${item.card.short_code} ${item.card.name}`).join(', '),
    subtotal: format.money(buyer.subtotal),
  })),
);
type AwaitingRow = (typeof awaitingRows.value)[number];

// ---- Confirming a payment: the cards become sold, so it asks first
const confirming = ref<Row | null>(null);
const confirmBusy = ref(false);
const confirmFailure = ref<string | null>(null);

async function confirmPayment() {
  if (!confirming.value) return;
  confirmBusy.value = true;
  confirmFailure.value = null;
  try {
    await api.markPaid(confirming.value.id);
    confirming.value = null;
    await refresh();
    toast.success(t('customer.confirm.done'));
  } catch (error) {
    confirmFailure.value = errorMessage(error);
  } finally {
    confirmBusy.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>

    <AppTabs v-model="active" :tabs="tabs" :label="t('settlements.tabs.label')">
      <template #default="{ active: current }">
        <AppCard
          v-if="current === 'awaiting'"
          as="section"
          :aria-label="t('settlements.tabs.awaiting')"
        >
          <AppDataState
            :loading="awaiting.isPending.value"
            :error="awaiting.isError.value"
            :empty="awaitingRows.length === 0"
            :labels="{
              loading: t('settlements.loading'),
              emptyTitle: t('settlements.awaitingEmpty'),
              errorTitle: t('settlements.error'),
              retry: t('settlements.retry'),
            }"
            @retry="awaiting.refetch()"
          >
            <AppTable
              :caption="t('settlements.tabs.awaiting')"
              :columns="awaitingColumns"
              :rows="awaitingRows"
              :row-key="(row: AwaitingRow) => row.id"
            >
              <template #cell-customer="{ row }">
                <NuxtLink :to="`/customers/${row.id}`">{{ row.name }}</NuxtLink>
              </template>
              <template #cell-action="{ row }">
                <AppButton
                  variant="primary"
                  size="sm"
                  :busy="busyKey === row.id"
                  :label="t('settlements.create.aria', { name: row.name })"
                  @click="createFor(row.buyer)"
                >
                  {{ t('settlements.create.open') }}
                </AppButton>
              </template>
            </AppTable>
            <div class="card__foot">{{ t('settlements.awaitingNote') }}</div>
          </AppDataState>
        </AppCard>

        <AppCard v-else as="section" :aria-label="t(shown.title)">
          <AppDataState
            :loading="shown.query.isLoading.value"
            :error="shown.query.isError.value"
            :empty="shown.rows.length === 0"
            :labels="{
              loading: t('settlements.loading'),
              emptyTitle: t(shown.empty),
              errorTitle: t('settlements.error'),
              retry: t('settlements.retry'),
            }"
            @retry="shown.query.refetch()"
          >
            <AppTable
              :caption="t(shown.title)"
              :columns="columns"
              :rows="shown.rows"
              :row-key="(row: Row) => row.id"
            >
              <template #cell-customer="{ row }">
                <NuxtLink :to="`/customers/${row.customer.id}`">{{ row.customer.name }}</NuxtLink>
                <span class="mono faint settlements__phone">{{ row.phone }}</span>
              </template>
              <template #cell-status="{ row }">
                <AppBadge :tone="row.status === 'PAID' ? 'success' : 'warning'">
                  {{ t(`settlements.status.${row.status}`) }}
                </AppBadge>
                <span
                  v-if="row.claimed && row.status === 'PENDING'"
                  class="faint settlements__phone"
                >
                  {{ t('settlements.claimed', { when: row.claimed }) }}
                </span>
                <span v-if="row.paidAt" class="faint settlements__phone">{{ row.paidAt }}</span>
              </template>
              <template #cell-action="{ row }">
                <div v-if="row.status === 'PENDING'" class="row">
                  <AppButton
                    size="sm"
                    :busy="busyKey === row.id"
                    :label="t('settlements.link.aria', { name: row.customer.name })"
                    @click="linkFor(row)"
                  >
                    {{ t('settlements.link.open') }}
                  </AppButton>
                  <AppButton
                    v-if="canConfirm"
                    size="sm"
                    variant="primary"
                    :label="t('settlements.confirm.aria', { name: row.customer.name })"
                    @click="
                      confirmFailure = null;
                      confirming = row;
                    "
                  >
                    {{ t('customer.confirm.action') }}
                  </AppButton>
                </div>
              </template>
            </AppTable>
            <div v-if="shown.query.hasNextPage.value" class="row customers__more card__foot">
              <AppButton
                size="sm"
                :busy="shown.query.isFetchingNextPage.value"
                @click="shown.query.fetchNextPage()"
              >
                {{ t('settlements.loadMore') }}
              </AppButton>
            </div>
          </AppDataState>
        </AppCard>
      </template>
    </AppTabs>

    <!-- The link shows only once, when it is made -->
    <AppModal
      :open="link !== null"
      :title="t('settlements.link.title')"
      :close-label="t('settlements.close')"
      @close="link = null"
    >
      <div class="stack">
        <p class="muted">{{ t('settlements.link.text', { name: link?.name ?? '' }) }}</p>
        <span class="mono settlements__url">{{ link?.url }}</span>
        <p class="faint">{{ t('settlements.link.once', { days: 14 }) }}</p>
      </div>
      <template #foot>
        <AppButton @click="copyLink">
          <AppIcon name="copy" />
          {{ t('settlements.link.copy') }}
        </AppButton>
        <a
          v-if="link"
          class="btn btn--primary"
          :href="link.whatsapp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <AppIcon name="message" />
          {{ t('settlements.link.whatsapp') }}
        </a>
      </template>
    </AppModal>

    <AppModal
      :open="confirming !== null"
      :title="t('customer.confirm.title')"
      :close-label="t('settlements.close')"
      @close="confirming = null"
    >
      <div class="stack">
        <p>{{ t('customer.confirm.text', { total: confirming?.total ?? '' }) }}</p>
        <p v-if="confirmFailure" role="alert" class="hint hint--error">{{ confirmFailure }}</p>
      </div>
      <template #foot>
        <AppButton @click="confirming = null">{{ t('customer.confirm.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="confirmBusy" @click="confirmPayment">
          {{ t('customer.confirm.confirm') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
