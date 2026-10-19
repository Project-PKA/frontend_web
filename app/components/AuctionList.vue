<script setup lang="ts">
import { createAuctionsApi, type Auction } from '../api/auctions';
import { TAB_STATUS, type AuctionTab } from '../utils/auctions';
import { cardTitle } from '../utils/inventory';
import { useCursorList } from '../utils/cursor-list';
import type { TableColumn } from './AppTable.vue';

/**
 * The auctions of one tab of the list. Each tab asks the API for its own status, by cursor, and
 * the running ones are asked again by themselves (the bids move); those waiting for the store to
 * validate a ceiling are shown first, because they need an action.
 */
const props = defineProps<{ tab: AuctionTab }>();

/** The running auctions are live: they ask again while the tab is on screen. */
const LIVE_REFRESH_MS = 15_000;

const { t } = useI18n();
const access = useAccessStore();
const format = useFormat();
const api = createAuctionsApi(useApi());

const main = useCursorList({
  queryKey: () => ['auctions', access.storeId, props.tab],
  fetchPage: (cursor, signal) => api.list(TAB_STATUS[props.tab], cursor, signal),
  refetchInterval: () => (props.tab === 'active' ? LIVE_REFRESH_MS : false),
});
const paused = useCursorList({
  queryKey: () => ['auctions', access.storeId, 'paused'],
  fetchPage: (cursor, signal) => api.list('PAUSED_FOR_VALIDATION', cursor, signal),
  enabled: () => props.tab === 'active',
  refetchInterval: () => (props.tab === 'active' ? LIVE_REFRESH_MS : false),
});

const items = computed<Auction[]>(() =>
  props.tab === 'active' ? [...paused.items.value, ...main.items.value] : main.items.value,
);

const columns = computed<TableColumn[]>(() => {
  const card = { key: 'card', label: t('auctions.columns.card') };
  const type = { key: 'type', label: t('auctions.columns.type') };
  switch (props.tab) {
    case 'active':
      return [
        card,
        type,
        { key: 'ends', label: t('auctions.columns.ends') },
        { key: 'bids', label: t('auctions.columns.bids'), numeric: true },
        { key: 'highest', label: t('auctions.columns.highest'), numeric: true },
        { key: 'state', label: '' },
      ];
    case 'scheduled':
      return [
        card,
        type,
        { key: 'start', label: t('auctions.columns.start') },
        { key: 'end', label: t('auctions.columns.end') },
        { key: 'action', label: '' },
      ];
    case 'finished':
      return [
        card,
        { key: 'closed', label: t('auctions.columns.closed') },
        { key: 'raised', label: t('auctions.columns.raised'), numeric: true },
        { key: 'winner', label: t('auctions.columns.winner') },
      ];
    default:
      return [card, type, { key: 'end', label: t('auctions.columns.wasToEnd') }];
  }
});

function toRow(auction: Auction) {
  return {
    id: auction.id,
    code: auction.card.short_code,
    title: cardTitle(auction.card.catalog),
    type: auction.type,
    paused: auction.status === 'PAUSED_FOR_VALIDATION',
    ends: format.dateTime(auction.end_time),
    start: format.dateTime(auction.start_time),
    end: format.dateTime(auction.end_time),
    closed: format.dateTime(auction.end_time),
    bids: auction.bid_count,
    highest: auction.current_bid === null ? '' : format.money(auction.current_bid),
    raised: auction.leader && auction.current_bid !== null ? format.money(auction.current_bid) : '',
    winner: auction.leader?.name ?? '',
  };
}
type Row = ReturnType<typeof toRow>;
const rows = computed(() => items.value.map(toRow));

const loading = computed(() => main.isLoading.value);
const failed = computed(() => main.isError.value);

function retry() {
  void main.refetch();
  if (props.tab === 'active') void paused.refetch();
}
</script>

<template>
  <AppCard as="section" :aria-label="t(`auctions.tabs.${tab}`)">
    <AppDataState
      :loading="loading"
      :error="failed"
      :empty="rows.length === 0"
      :labels="{
        loading: t('auctions.loading'),
        emptyTitle: t(`auctions.empty.${tab}.title`),
        emptyText: t(`auctions.empty.${tab}.text`),
        errorTitle: t('auctions.error.title'),
        errorText: t('auctions.error.text'),
        retry: t('auctions.error.retry'),
      }"
      @retry="retry"
    >
      <AppTable
        :caption="t(`auctions.tabs.${tab}`)"
        :columns="columns"
        :rows="rows"
        :row-key="(row: Row) => row.id"
      >
        <template #cell-card="{ row }">
          <span class="id-chip">#{{ row.code }}</span>
          <NuxtLink class="auctions__card" :to="`/auctions/${row.id}`">{{ row.title }}</NuxtLink>
        </template>
        <template #cell-type="{ row }">
          <AppBadge :tone="row.type === 'POLL' ? 'info' : undefined">
            {{ t(`auctions.types.${row.type}`) }}
          </AppBadge>
        </template>
        <template #cell-state="{ row }">
          <AppBadge v-if="row.paused" tone="warning">{{ t('auctions.state.paused') }}</AppBadge>
          <AppBadge v-else tone="success" live>{{ t('auctions.state.live') }}</AppBadge>
        </template>
        <template #cell-winner="{ row }">
          <template v-if="row.winner">{{ row.winner }}</template>
          <span v-else class="muted">{{ t('auctions.noWinner') }}</span>
        </template>
        <template #cell-action="{ row }">
          <AppButton size="sm" :to="`/auctions/${row.id}/edit`">
            {{ t('auctions.edit') }}
          </AppButton>
        </template>
      </AppTable>
      <div v-if="main.hasNextPage.value" class="row auctions__more card__foot">
        <AppButton size="sm" :busy="main.isFetchingNextPage.value" @click="main.fetchNextPage()">
          {{ t('auctions.loadMore') }}
        </AppButton>
      </div>
    </AppDataState>
  </AppCard>
</template>
