<script setup lang="ts">
import { createCustomersApi, type Customer } from '../../api/customers';
import type { TableColumn } from '../../components/AppTable.vue';
import { useCursorList } from '../../utils/cursor-list';
import {
  TYPE_FILTERS,
  filtersToAddress,
  isIncomplete,
  parseCustomerFilters,
  toApiFilters,
} from '../../utils/customers';
import { formatStoredPhone } from '../../utils/phone';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.customers',
  access: { level: 'store', permission: 'can_manage_customers' },
});

/** Wait for the person to stop typing before asking the API. */
const SEARCH_DELAY_MS = 300;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const access = useAccessStore();
const format = useFormat();
const api = createCustomersApi(useApi());

// The filters live in the address (`/customers?type=CONSIGNOR`): a reload or a shared link keeps them.
const initial = parseCustomerFilters(route.query);
const search = ref(initial.q ?? '');
const query = ref(initial.q ?? '');
const type = ref<string>(initial.type ?? '');

let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => (query.value = value.trim()), SEARCH_DELAY_MS);
});
onBeforeUnmount(() => clearTimeout(timer));

const filters = computed(() => parseCustomerFilters({ q: query.value, type: type.value }));
watch(filters, (next) => void router.replace({ query: filtersToAddress(next) }));

const list = useCursorList({
  queryKey: () => ['customers', access.storeId, filters.value],
  fetchPage: (cursor, signal) => api.list(toApiFilters(filters.value), cursor, signal),
});

const filtered = computed(() => Object.keys(filters.value).length > 0);

function clearFilters() {
  search.value = '';
  query.value = '';
  type.value = '';
}

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('customers.columns.name') },
  { key: 'phone', label: t('customers.columns.phone') },
  { key: 'cpf', label: t('customers.columns.cpf') },
  { key: 'kind', label: t('customers.columns.type') },
  { key: 'last', label: t('customers.columns.last') },
]);

function toRow(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: formatStoredPhone(customer.phone),
    cpf: customer.cpf_masked ?? '',
    incomplete: isIncomplete(customer),
    blacklisted: customer.is_blacklisted,
    last: customer.last_interaction_at ? format.relative(customer.last_interaction_at) : '',
  };
}
type Row = ReturnType<typeof toRow>;
const rows = computed(() => list.items.value.map(toRow));
</script>

<template>
  <div class="stack">
    <div class="filters" role="search">
      <input
        v-model="search"
        class="input grow"
        type="search"
        :placeholder="t('customers.filters.search')"
        :aria-label="t('customers.filters.search')"
      />
      <select v-model="type" class="select" :aria-label="t('customers.filters.type')">
        <option value="">{{ t('customers.filters.typeAll') }}</option>
        <option v-for="item in TYPE_FILTERS" :key="item" :value="item">
          {{ t(`customers.types.${item}`) }}
        </option>
      </select>
      <div class="end">
        <AppButton to="/customers/blacklist">
          <AppIcon name="shield" />
          {{ t('customers.blacklistLink') }}
        </AppButton>
      </div>
    </div>

    <AppCard as="section" :aria-label="t('customers.caption')">
      <AppState v-if="list.isLoading.value" kind="loading" :title="t('customers.loading')" />
      <AppState
        v-else-if="list.isError.value"
        kind="error"
        :title="t('customers.error.title')"
        :text="t('customers.error.text')"
        :action-label="t('customers.error.retry')"
        @action="list.refetch()"
      />
      <AppState
        v-else-if="rows.length === 0 && !filtered"
        kind="empty"
        :title="t('customers.empty.title')"
        :text="t('customers.empty.text')"
      />
      <AppState
        v-else-if="rows.length === 0"
        kind="empty"
        :title="t('customers.noMatch.title')"
        :text="t('customers.noMatch.text')"
        :action-label="t('customers.noMatch.clear')"
        @action="clearFilters"
      />
      <template v-else>
        <AppTable
          :caption="t('customers.caption')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: Row) => row.id"
        >
          <template #cell-name="{ row }">
            <NuxtLink :to="`/customers/${row.id}`">{{ row.name }}</NuxtLink>
          </template>
          <template #cell-phone="{ row }">
            <span class="mono">{{ row.phone }}</span>
          </template>
          <template #cell-cpf="{ row }">
            <span v-if="row.cpf" class="mono">{{ row.cpf }}</span>
            <span v-else class="faint">—</span>
          </template>
          <template #cell-kind="{ row }">
            <AppBadge v-if="row.blacklisted" tone="danger">{{
              t('customers.blacklisted')
            }}</AppBadge>
            <AppBadge v-else-if="row.incomplete" tone="warning">
              {{ t('customers.kinds.VISITOR') }}
            </AppBadge>
            <AppBadge v-else tone="success">{{ t('customers.kinds.CUSTOMER') }}</AppBadge>
          </template>
        </AppTable>
        <div v-if="list.hasNextPage.value" class="row customers__more card__foot">
          <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
            {{ t('customers.loadMore') }}
          </AppButton>
        </div>
      </template>
    </AppCard>
  </div>
</template>
