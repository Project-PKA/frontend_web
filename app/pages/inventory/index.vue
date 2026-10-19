<script setup lang="ts">
import { createInventoryApi, CARD_ORIGINS, CARD_STATUSES } from '../../api/inventory';
import type { CardFilters, CardItem } from '../../api/inventory';
import type { TableColumn } from '../../components/AppTable.vue';
import { useCursorList } from '../../utils/cursor-list';
import {
  cardTitle,
  filtersToQuery,
  hasFilters,
  parseFilters,
  statusTone,
} from '../../utils/inventory';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.inventory',
  access: { level: 'store', permission: 'can_manage_inventory' },
});

/** Wait for the person to stop typing before asking the API. */
const SEARCH_DELAY_MS = 300;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const access = useAccessStore();
const toast = useToast();
const api = createInventoryApi(useApi());

// The filters live in the address (`/inventory?status=SOLD`): a reload or a shared link keeps them.
const initial = parseFilters(route.query);
const search = ref(initial.q ?? '');
const query = ref(initial.q ?? '');
const status = ref<string>(initial.status ?? '');
const origin = ref<string>(initial.origin ?? '');

let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => (query.value = value.trim()), SEARCH_DELAY_MS);
});
onBeforeUnmount(() => clearTimeout(timer));

const filters = computed<CardFilters>(() =>
  parseFilters({ q: query.value, status: status.value, origin: origin.value }),
);
watch(filters, (next) => void router.replace({ query: filtersToQuery(next) }));

const list = useCursorList({
  queryKey: () => ['inventory', access.storeId, filters.value],
  fetchPage: (cursor, signal) => api.list(filters.value, cursor, signal),
});

const filtered = computed(() => hasFilters(filters.value));

function clearFilters() {
  search.value = '';
  query.value = '';
  status.value = '';
  origin.value = '';
}

const columns = computed<TableColumn[]>(() => [
  { key: 'shortCode', label: t('inventory.columns.id') },
  { key: 'title', label: t('inventory.columns.card') },
  { key: 'set', label: t('inventory.columns.set') },
  { key: 'language', label: t('inventory.columns.language') },
  { key: 'condition', label: t('inventory.columns.condition') },
  { key: 'origin', label: t('inventory.columns.origin') },
  { key: 'status', label: t('inventory.columns.status') },
]);

function toRow(card: CardItem) {
  return {
    id: card.id,
    shortCode: card.short_code,
    title: cardTitle(card.catalog),
    set: card.catalog.set_name,
    language: card.language.toUpperCase(),
    condition: card.condition,
    origin: card.origin,
    status: card.status,
  };
}
type Row = ReturnType<typeof toRow>;
const rows = computed(() => list.items.value.map(toRow));

async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(`#${code}`);
    toast.info(t('inventory.copied', { code: `#${code}` }));
  } catch {
    toast.error(t('inventory.copyFailed'));
  }
}
</script>

<template>
  <div class="stack">
    <div class="filters" role="search">
      <input
        v-model="search"
        class="input grow"
        type="search"
        :placeholder="t('inventory.filters.search')"
        :aria-label="t('inventory.filters.search')"
      />
      <select v-model="status" class="select" :aria-label="t('inventory.filters.status')">
        <option value="">{{ t('inventory.filters.statusAll') }}</option>
        <option v-for="item in CARD_STATUSES" :key="item" :value="item">
          {{ t(`inventory.status.${item}`) }}
        </option>
      </select>
      <select v-model="origin" class="select" :aria-label="t('inventory.filters.origin')">
        <option value="">{{ t('inventory.filters.originAll') }}</option>
        <option v-for="item in CARD_ORIGINS" :key="item" :value="item">
          {{ t(`inventory.origin.${item}`) }}
        </option>
      </select>
      <div class="end">
        <AppButton variant="primary" to="/inventory/new">
          <AppIcon name="plus" />
          {{ t('inventory.register') }}
        </AppButton>
      </div>
    </div>

    <AppCard as="section" :aria-label="t('inventory.caption')">
      <AppState v-if="list.isLoading.value" kind="loading" :title="t('inventory.loading')" />
      <AppState
        v-else-if="list.isError.value"
        kind="error"
        :title="t('inventory.error.title')"
        :text="t('inventory.error.text')"
        :action-label="t('inventory.error.retry')"
        @action="list.refetch()"
      />
      <div v-else-if="rows.length === 0 && !filtered" class="empty">
        <div class="empty__art"><AppIcon name="box" /></div>
        <h3>{{ t('inventory.empty.title') }}</h3>
        <p class="muted inventory__empty-text">{{ t('inventory.empty.text') }}</p>
        <AppButton variant="primary" to="/inventory/new">
          <AppIcon name="plus" />
          {{ t('inventory.register') }}
        </AppButton>
      </div>
      <AppState
        v-else-if="rows.length === 0"
        kind="empty"
        :title="t('inventory.noMatch.title')"
        :text="t('inventory.noMatch.text')"
        :action-label="t('inventory.noMatch.clear')"
        @action="clearFilters"
      />
      <template v-else>
        <AppTable
          :caption="t('inventory.caption')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: Row) => row.id"
        >
          <template #cell-shortCode="{ row }">
            <AppIdChip
              :code="row.shortCode"
              :label="t('inventory.copy', { code: `#${row.shortCode}` })"
              @copy="copy"
            />
          </template>
          <template #cell-title="{ row }">
            <NuxtLink :to="`/inventory/${row.id}`">{{ row.title }}</NuxtLink>
          </template>
          <template #cell-condition="{ row }">
            <abbr :title="t(`inventory.conditions.${row.condition}`)">{{ row.condition }}</abbr>
          </template>
          <template #cell-origin="{ row }">
            <AppBadge :tone="row.origin === 'OWN' ? 'dashed' : 'primary'">
              {{ t(`inventory.origin.${row.origin}`) }}
            </AppBadge>
          </template>
          <template #cell-status="{ row }">
            <AppBadge :tone="statusTone(row.status)">{{
              t(`inventory.status.${row.status}`)
            }}</AppBadge>
          </template>
        </AppTable>
        <div v-if="list.hasNextPage.value" class="row inventory__more card__foot">
          <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
            {{ t('inventory.loadMore') }}
          </AppButton>
        </div>
      </template>
    </AppCard>
  </div>
</template>
