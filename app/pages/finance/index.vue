<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createFinanceApi } from '../../api/finance';
import type { TableColumn } from '../../components/AppTable.vue';
import {
  PERIODS,
  dayPoints,
  hourBars,
  parsePeriod,
  priceBands,
  sumMoney,
  toCents,
  type Period,
} from '../../utils/finance';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.finance',
  access: { level: 'store', permission: 'can_view_finance' },
});

const { t, te, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const access = useAccessStore();
const format = useFormat();
const api = createFinanceApi(useApi());

// The period is the only filter of the whole app, and it lives in the address.
const period = ref<Period>(parsePeriod(route.query));
watch(period, (next) => void router.replace({ query: next === 'today' ? {} : { period: next } }));

const key = (name: string) => ['finance', name, access.storeId, period.value] as const;
const overview = useQuery({
  queryKey: computed(() => key('overview')),
  queryFn: ({ signal }) => api.overview(period.value, signal),
});
const buyers = useQuery({
  queryKey: computed(() => key('buyers')),
  queryFn: ({ signal }) => api.topBuyers(period.value, signal),
});
const payouts = useQuery({
  queryKey: computed(() => key('payouts')),
  queryFn: ({ signal }) => api.payouts(period.value, signal),
});

const data = computed(() => overview.data.value);

// ---- Numbers
const payable = computed(() =>
  sumMoney((payouts.data.value?.items ?? []).map((item) => item.payout ?? '0')),
);

// ---- Charts
const days = computed(() => dayPoints(data.value?.daily ?? []));
const bands = computed(() =>
  priceBands(data.value?.sales_by_price ?? []).map((bar) => ({
    ...bar,
    label: te(`finance.bands.${bar.label}`) ? t(`finance.bands.${bar.label}`) : bar.label,
  })),
);
const hours = computed(() => hourBars(data.value?.bids_by_hour ?? []));

function named(prefix: string, name: string) {
  return te(`${prefix}.${name}`) ? t(`${prefix}.${name}`) : name;
}
const slicesOf = (rows: { key: string; revenue: string }[] | undefined, prefix: string) =>
  (rows ?? []).map((row) => ({ label: named(prefix, row.key), value: toCents(row.revenue) }));
const byOrigin = computed(() => slicesOf(data.value?.by_origin, 'finance.origins'));
const byLanguage = computed(() => slicesOf(data.value?.by_language, 'inventory.languages'));
const byCondition = computed(() => slicesOf(data.value?.by_condition, 'inventory.conditions'));

const hasSales = (items: { value: number }[]) => items.some((item) => item.value > 0);
const hasBars = (items: { value: number }[]) => items.some((item) => item.value > 0);

/** The amounts of the axis: whole reais, with the thousands separator of the language. */
const tick = (cents: number) => new Intl.NumberFormat(locale.value).format(Math.round(cents / 100));

// ---- Top buyers: the bar of each is its share of the best one
const top = computed(() => {
  const rows = (buyers.data.value?.items ?? []).filter((row) => row.customer?.id);
  const best = Math.max(0, ...rows.map((row) => toCents(row.total ?? '0')));
  return rows.map((row) => ({
    id: row.customer?.id ?? '',
    name: row.customer?.name ?? '',
    total: row.total ?? '0',
    width: best > 0 ? Math.round((toCents(row.total ?? '0') / best) * 100) : 0,
  }));
});

// ---- Payouts
const payoutColumns = computed<TableColumn[]>(() => [
  { key: 'consignor', label: t('finance.payouts.consignor') },
  { key: 'items', label: t('finance.payouts.items'), numeric: true },
  { key: 'gross', label: t('finance.payouts.gross'), numeric: true },
  { key: 'commission', label: t('finance.payouts.commission'), numeric: true },
  { key: 'payout', label: t('finance.payouts.payout'), numeric: true },
]);
const payoutRows = computed(() =>
  (payouts.data.value?.items ?? [])
    .filter((row) => row.consignor?.id)
    .map((row) => ({
      id: row.consignor?.id ?? '',
      name: row.consignor?.name ?? '',
      items: row.items_sold ?? 0,
      gross: format.money(row.gross ?? '0'),
      commission: format.money(row.commission ?? '0'),
      payout: format.money(row.payout ?? '0'),
    })),
);
type PayoutRow = (typeof payoutRows.value)[number];
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div class="seg" role="group" :aria-label="t('finance.period.label')">
        <button
          v-for="item in PERIODS"
          :key="item"
          type="button"
          :class="{ 'is-active': period === item }"
          :aria-pressed="period === item"
          @click="period = item"
        >
          {{ t(`finance.period.${item}`) }}
        </button>
      </div>
    </div>

    <AppState v-if="overview.isPending.value" kind="loading" :title="t('finance.loading')" />
    <AppState
      v-else-if="overview.isError.value || !data"
      kind="error"
      :title="t('finance.error.title')"
      :text="t('finance.error.text')"
      :action-label="t('finance.error.retry')"
      @action="overview.refetch()"
    />

    <template v-else>
      <div class="grid grid--kpi">
        <AppKpi
          icon="wallet"
          :value="format.money(data.kpis.revenue)"
          :label="t('finance.kpi.revenue')"
        />
        <AppKpi
          icon="chart"
          :value="format.money(data.kpis.profit)"
          :label="t('finance.kpi.profit')"
        >
          <template #badge>
            <AppBadge tone="success">{{ t('finance.kpi.profitNote') }}</AppBadge>
          </template>
        </AppKpi>
        <AppKpi
          icon="users"
          :value="payouts.isPending.value ? '—' : format.money(payable)"
          :label="t('finance.kpi.payable')"
        >
          <template #badge>
            <AppBadge tone="warning">{{ t('finance.kpi.payableNote') }}</AppBadge>
          </template>
        </AppKpi>
        <AppKpi
          icon="bolt"
          :value="format.money(data.kpis.average_item)"
          :label="t('finance.kpi.average')"
        />
      </div>

      <div class="cols-21">
        <AppCard as="section" :aria-label="t('finance.daily.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.daily.title') }}</h2>
            <span class="muted finance__legend">
              <i class="dot finance__dot finance__dot--revenue" /> {{ t('finance.daily.gross') }}
              &nbsp;
              <i class="dot finance__dot finance__dot--profit" /> {{ t('finance.daily.net') }}
            </span>
          </div>
          <div class="card__body">
            <FinanceLineChart
              v-if="days.length > 0"
              :days="days"
              :label="t('finance.daily.title')"
              :format-tick="tick"
            />
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
          <div class="card__foot">{{ t('finance.daily.axis') }}</div>
        </AppCard>

        <AppCard as="section" :aria-label="t('finance.origin.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.origin.title') }}</h2>
          </div>
          <div class="card__body">
            <FinancePie
              v-if="hasSales(byOrigin)"
              :items="byOrigin"
              :label="t('finance.origin.title')"
            />
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
          <div class="card__foot">{{ t('finance.origin.note') }}</div>
        </AppCard>
      </div>

      <div class="cols-2">
        <AppCard as="section" :aria-label="t('finance.price.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.price.title') }}</h2>
            <span class="faint finance__unit">{{ t('finance.price.unit') }}</span>
          </div>
          <div class="card__body">
            <FinanceBars v-if="hasBars(bands)" :bars="bands" :label="t('finance.price.title')" />
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
          <div class="card__foot">{{ t('finance.price.note') }}</div>
        </AppCard>

        <AppCard as="section" :aria-label="t('finance.hours.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.hours.title') }}</h2>
            <span class="faint finance__unit">{{ t('finance.hours.unit') }}</span>
          </div>
          <div class="card__body">
            <FinanceBars
              v-if="hasBars(hours)"
              :bars="hours"
              :label="t('finance.hours.title')"
              :label-every="3"
            />
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
          <div class="card__foot">{{ t('finance.hours.note') }}</div>
        </AppCard>
      </div>

      <div class="cols-3">
        <AppCard as="section" :aria-label="t('finance.language.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.language.title') }}</h2>
          </div>
          <div class="card__body">
            <FinancePie
              v-if="hasSales(byLanguage)"
              :items="byLanguage"
              :label="t('finance.language.title')"
            />
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
        </AppCard>

        <AppCard as="section" :aria-label="t('finance.condition.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.condition.title') }}</h2>
          </div>
          <div class="card__body">
            <FinancePie
              v-if="hasSales(byCondition)"
              :items="byCondition"
              :label="t('finance.condition.title')"
            />
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
        </AppCard>

        <AppCard as="section" :aria-label="t('finance.buyers.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('finance.buyers.title') }}</h2>
          </div>
          <div class="card__body">
            <p v-if="buyers.isPending.value" class="muted">{{ t('finance.loading') }}</p>
            <p v-else-if="buyers.isError.value" role="alert" class="hint hint--error">
              {{ t('finance.buyers.error') }}
            </p>
            <ul v-else-if="top.length > 0" class="stack finance__list">
              <li v-for="buyer in top" :key="buyer.id" class="hbar">
                <NuxtLink :to="`/customers/${buyer.id}`">{{ buyer.name }}</NuxtLink>
                <div class="hbar__t" aria-hidden="true">
                  <i :style="{ width: `${buyer.width}%` }" />
                </div>
                <b class="mono">{{ format.money(buyer.total) }}</b>
              </li>
            </ul>
            <p v-else class="muted">{{ t('finance.noData') }}</p>
          </div>
        </AppCard>
      </div>

      <AppCard as="section" :aria-label="t('finance.payouts.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('finance.payouts.title') }}</h2>
          <span class="faint finance__unit">{{ t('finance.payouts.note') }}</span>
        </div>
        <AppState
          v-if="payouts.isError.value"
          kind="error"
          :title="t('finance.payouts.error')"
          :action-label="t('finance.error.retry')"
          @action="payouts.refetch()"
        />
        <p v-else-if="payouts.isPending.value" class="card__body muted">
          {{ t('finance.loading') }}
        </p>
        <p v-else-if="payoutRows.length === 0" class="card__body muted">
          {{ t('finance.payouts.empty') }}
        </p>
        <AppTable
          v-else
          :caption="t('finance.payouts.title')"
          :columns="payoutColumns"
          :rows="payoutRows"
          :row-key="(row: PayoutRow) => row.id"
        >
          <template #cell-consignor="{ row }">
            <NuxtLink :to="`/customers/${row.id}`">{{ row.name }}</NuxtLink>
          </template>
          <template #cell-payout="{ row }">
            <b>{{ row.payout }}</b>
          </template>
        </AppTable>
      </AppCard>
    </template>
  </div>
</template>
