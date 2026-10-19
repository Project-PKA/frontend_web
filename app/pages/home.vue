<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createDashboardApi } from '../api/dashboard';
import type { TableColumn } from '../components/AppTable.vue';
import {
  cardRows,
  pollLabels,
  settlementRows,
  setupComplete,
  setupDone,
  setupSteps,
  type SettlementRow,
} from '../utils/home';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.home',
  access: { level: 'store' },
});

/** The home is live: it asks again while the page is open (and stops when the tab is hidden). */
const REFRESH_MS = 15_000;

const { t } = useI18n();
const access = useAccessStore();
const format = useFormat();
const api = createDashboardApi(useApi());

const home = useQuery({
  queryKey: computed(() => ['home', access.storeId]),
  queryFn: ({ signal }) => api.home(signal),
  refetchInterval: REFRESH_MS,
});

const data = computed(() => home.data.value);
// "12 minutes ago" is counted from the moment the data arrived, so it moves with each refresh.
const now = computed(() => (home.dataUpdatedAt.value > 0 ? home.dataUpdatedAt.value : Date.now()));

const steps = computed(() => (data.value ? setupSteps(data.value.setup) : []));
const showSetup = computed(() => (data.value ? !setupComplete(data.value.setup) : false));
const done = computed(() => (data.value ? setupDone(data.value.setup) : 0));

const canInventory = computed(() => access.can('can_manage_inventory'));
const canAuctions = computed(() => access.can('can_manage_auctions'));
const canCustomers = computed(() => access.can('can_manage_customers'));

/** Only the owner can open the settings, so only the owner is sent there. */
function stepLink(id: string): string | null {
  if (id === 'whatsapp') return access.isOwner ? '/settings' : null;
  if (id === 'card') return canInventory.value ? '/inventory/new' : null;
  if (id === 'auction') return canAuctions.value ? '/auctions/new' : null;
  return null;
}

const cardColumns = computed<TableColumn[]>(() => [
  { key: 'shortCode', label: t('home.columns.id') },
  { key: 'name', label: t('home.columns.card') },
]);

const settlementColumns = computed<TableColumn[]>(() => [
  { key: 'customerName', label: t('home.columns.customer') },
  { key: 'items', label: t('home.columns.items') },
  { key: 'amount', label: t('home.columns.value'), numeric: true },
  { key: 'closed', label: t('home.columns.closed') },
  { key: 'action', label: '' },
]);

const pollCards = computed(() => pollLabels(data.value?.poll_alerts ?? []));
const cards = computed(() => cardRows(data.value?.cards_without_auction ?? []));
const settlements = computed(() => settlementRows(data.value?.quick_settlements ?? []));

/** What each cell of the settlements table shows (the amount is formatted, never turned into a number). */
function cells(row: SettlementRow) {
  return {
    items: t('home.itemsCount', { count: row.items }, row.items),
    amount: row.totalAmount === null ? '' : format.money(row.totalAmount),
    closed: row.createdAt === null ? '' : format.relative(row.createdAt, now.value),
  };
}
</script>

<template>
  <div class="stack">
    <AppState v-if="home.isPending.value" kind="loading" :title="t('home.loading')" />
    <AppState
      v-else-if="!data"
      kind="error"
      :title="t('home.error.title')"
      :text="t('home.error.text')"
      :action-label="t('home.error.retry')"
      @action="home.refetch()"
    />

    <template v-else>
      <AppCard v-if="showSetup" as="section" :title="t('home.setup.title')">
        <template #head>
          <span class="mono faint">{{
            t('home.setup.progress', { done, total: steps.length })
          }}</span>
        </template>
        <AppProgress
          :value="done"
          :max="steps.length"
          :label="t('home.setup.title')"
          :value-text="t('home.setup.progress', { done, total: steps.length })"
        />
        <ul class="home__steps">
          <li v-for="step in steps" :key="step.id" class="row home__step">
            <AppBadge :tone="step.done ? 'success' : 'warning'">
              {{ step.done ? t('home.setup.done') : t('home.setup.pending') }}
            </AppBadge>
            <div class="grow">
              <b>{{ t(`home.setup.steps.${step.id}.title`) }}</b>
              <br />
              <span class="muted">{{ t(`home.setup.steps.${step.id}.text`) }}</span>
            </div>
            <template v-if="!step.done">
              <AppButton v-if="step.blocked" size="sm" disabled>
                {{ t(`home.setup.steps.${step.id}.action`) }}
              </AppButton>
              <AppButton
                v-else-if="stepLink(step.id)"
                size="sm"
                variant="primary"
                :to="stepLink(step.id) ?? undefined"
              >
                {{ t(`home.setup.steps.${step.id}.action`) }}
              </AppButton>
            </template>
          </li>
        </ul>
      </AppCard>

      <div v-if="data.poll_alerts.length > 0" class="alert alert--warning" role="alert">
        <AppIcon name="alert" />
        <div class="alert__body">
          <p class="alert__title">
            {{
              t('home.pollAlert.title', { count: data.poll_alerts.length }, data.poll_alerts.length)
            }}
          </p>
          <span class="muted">{{ pollCards.join(' · ') }}</span>
        </div>
        <AppButton v-if="canAuctions" variant="primary" size="sm" to="/auctions">
          {{ t('home.pollAlert.action') }}
        </AppButton>
      </div>

      <div class="grid grid--kpi5" role="group" :aria-label="t('home.kpis.label')">
        <AppKpi icon="bolt" :value="data.kpis.active_auctions" :label="t('home.kpis.active')">
          <template #badge>
            <AppBadge tone="success" live>{{ t('home.kpis.live') }}</AppBadge>
          </template>
          <template v-if="canAuctions" #link>
            <NuxtLink class="home__kpi-link" to="/auctions">{{
              t('home.kpis.openMonitor')
            }}</NuxtLink>
          </template>
        </AppKpi>
        <AppKpi icon="clock" :value="data.kpis.scheduled_today" :label="t('home.kpis.scheduled')" />
        <AppKpi icon="message" :value="data.kpis.bids_in_active" :label="t('home.kpis.bids')" />
        <AppKpi
          icon="wallet"
          :value="data.kpis.pending_settlements"
          :label="t('home.kpis.settlements')"
        >
          <template v-if="data.kpis.pending_settlements > 0" #badge>
            <AppBadge tone="warning">{{ t('home.kpis.attention') }}</AppBadge>
          </template>
          <template v-if="data.kpis.pending_settlements > 0" #link>
            <a class="home__kpi-link" href="#settlements">{{ t('home.kpis.goToQueue') }}</a>
          </template>
        </AppKpi>
        <AppKpi
          icon="box"
          :value="data.kpis.cards_without_auction"
          :label="t('home.kpis.noAuction')"
        >
          <template v-if="data.kpis.cards_without_auction > 0" #badge>
            <AppBadge tone="primary">{{ t('home.kpis.reminder') }}</AppBadge>
          </template>
          <template v-if="data.kpis.cards_without_auction > 0" #link>
            <a class="home__kpi-link" href="#no-auction">{{ t('home.kpis.seeCards') }}</a>
          </template>
        </AppKpi>
      </div>

      <AppCard
        v-if="cards.length > 0"
        id="no-auction"
        as="section"
        :title="t('home.noAuction.title')"
      >
        <template v-if="canInventory" #head>
          <NuxtLink to="/inventory">{{ t('home.noAuction.seeStock') }}</NuxtLink>
        </template>
        <AppTable
          :caption="t('home.noAuction.title')"
          :columns="cardColumns"
          :rows="cards"
          :row-key="(row) => row.id"
        >
          <template #cell-shortCode="{ row }">
            <span class="id-chip">#{{ row.shortCode }}</span>
          </template>
        </AppTable>
        <template #foot>{{ t('home.noAuction.foot') }}</template>
      </AppCard>

      <AppCard
        v-if="settlements.length > 0"
        id="settlements"
        as="section"
        :title="t('home.settlements.title')"
      >
        <AppTable
          :caption="t('home.settlements.title')"
          :columns="settlementColumns"
          :rows="settlements"
          :row-key="(row) => row.id"
        >
          <template #cell-items="{ row }">{{ cells(row).items }}</template>
          <template #cell-amount="{ row }">{{ cells(row).amount }}</template>
          <template #cell-closed="{ row }">{{ cells(row).closed }}</template>
          <template #cell-action="{ row }">
            <AppButton
              v-if="canCustomers && row.customerId"
              size="sm"
              :to="`/customers/${row.customerId}`"
            >
              {{ t('home.settlements.close') }}
            </AppButton>
          </template>
        </AppTable>
      </AppCard>
    </template>
  </div>
</template>
