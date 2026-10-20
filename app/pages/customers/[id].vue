<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useForm } from 'vee-validate';
import { createCustomersApi } from '../../api/customers';
import { createSettlementsApi } from '../../api/settlements';
import type { TableColumn } from '../../components/AppTable.vue';
import { useCursorList } from '../../utils/cursor-list';
import {
  customerFormSchema,
  formOf,
  isIncomplete,
  toChanges,
  type CustomerForm,
} from '../../utils/customers';
import { maskCep, maskCpf } from '../../utils/documents';
import { formatStoredPhone } from '../../utils/phone';
import { toFormSchema } from '../../utils/zod-schema';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'customer.title',
  access: { level: 'store', permission: 'can_manage_customers' },
});

const { t } = useI18n();
const route = useRoute();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createCustomersApi(useApi());

const id = computed(() => String(route.params.id));
const detail = useQuery({
  queryKey: computed(() => ['customer', access.storeId, id.value]),
  queryFn: ({ signal }) => api.get(id.value, signal),
});
const customer = computed(() => detail.data.value);

// ---- The data of the customer
const form = useForm({
  validationSchema: toFormSchema(customerFormSchema),
  initialValues: {
    name: '',
    email: '',
    cpf: '',
    zip: '',
    street: '',
    number: '',
    comp: '',
    city: '',
    state: '',
  } satisfies CustomerForm,
});
const [name] = form.defineField('name');
const [email] = form.defineField('email');
const [cpfField] = form.defineField('cpf');
const [zipField] = form.defineField('zip');
const [street] = form.defineField('street');
const [number] = form.defineField('number');
const [comp] = form.defineField('comp');
const [city] = form.defineField('city');
const [state] = form.defineField('state');

// The CPF and the CEP are written with their dots and dash as they are typed.
const cpf = computed({
  get: () => cpfField.value,
  set: (value) => (cpfField.value = maskCpf(value)),
});
const zip = computed({
  get: () => zipField.value,
  set: (value) => (zipField.value = maskCep(value)),
});

watch(
  customer,
  (current) => {
    if (current) form.resetForm({ values: formOf(current) });
  },
  { immediate: true },
);

const errors = computed(() => {
  const keys = [
    'name',
    'email',
    'cpf',
    'zip',
    'street',
    'number',
    'comp',
    'city',
    'state',
  ] as const;
  return Object.fromEntries(
    keys.map((key) => [key, form.errors.value[key] ? t(form.errors.value[key]) : null]),
  );
});

const saving = ref(false);
const saveError = ref<string | null>(null);

async function refresh() {
  await Promise.all(
    ['customer', 'customers'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}

const save = form.handleSubmit(async (values) => {
  const current = customer.value;
  if (!current) return;
  const changes = toChanges(current, values);
  if (Object.keys(changes).length === 0) {
    toast.info(t('customer.nothingChanged'));
    return;
  }
  saving.value = true;
  saveError.value = null;
  try {
    await api.update(current.id, changes);
    await refresh();
    toast.success(t('customer.saved'));
  } catch (error) {
    saveError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
});

// ---- The blacklist
const blocking = ref(false);
const reason = ref('');
const reasonError = ref<string | null>(null);
const moderating = ref(false);
const moderationError = ref<string | null>(null);

function askToBlock() {
  reason.value = '';
  reasonError.value = null;
  moderationError.value = null;
  blocking.value = true;
}

async function block() {
  const text = reason.value.trim();
  if (text === '') {
    reasonError.value = t('validation.required');
    return;
  }
  if (text.length > 300) {
    reasonError.value = t('validation.tooLong');
    return;
  }
  moderating.value = true;
  moderationError.value = null;
  try {
    await api.blacklist(id.value, text);
    blocking.value = false;
    await refresh();
    toast.success(t('customer.blocked'));
  } catch (error) {
    moderationError.value = errorMessage(error);
  } finally {
    moderating.value = false;
  }
}

async function unblock() {
  moderating.value = true;
  moderationError.value = null;
  try {
    await api.unblacklist(id.value);
    await refresh();
    toast.success(t('customer.unblocked'));
  } catch (error) {
    moderationError.value = errorMessage(error);
  } finally {
    moderating.value = false;
  }
}

// ---- The tabs: what the customer owes, and what they bid
// The wallet shows the store's money, so the API asks for `can_view_finance`: no tab without it.
const tabs = computed(() => [
  { id: 'settlements', label: t('customer.tabs.settlements') },
  { id: 'bids', label: t('customer.tabs.bids') },
  ...(access.can('can_view_finance') ? [{ id: 'wallet', label: t('customer.tabs.wallet') }] : []),
]);
const active = ref('settlements');

const settlements = useCursorList({
  queryKey: () => ['customer-settlements', access.storeId, id.value],
  fetchPage: (cursor, signal) => api.settlements(id.value, cursor, signal),
  enabled: () => active.value === 'settlements',
});
const bids = useCursorList({
  queryKey: () => ['customer-bids', access.storeId, id.value],
  fetchPage: (cursor, signal) => api.bids(id.value, cursor, signal),
  enabled: () => active.value === 'bids',
});

// Only the store confirms a payment, and the API asks for `can_view_finance`.
const canConfirm = computed(() => access.can('can_view_finance'));
const settlementColumns = computed<TableColumn[]>(() => [
  { key: 'created', label: t('customer.columns.date') },
  { key: 'items', label: t('customer.columns.items'), numeric: true },
  { key: 'total', label: t('customer.columns.total'), numeric: true },
  { key: 'status', label: t('customer.columns.status') },
  ...(canConfirm.value ? [{ key: 'action', label: '' }] : []),
]);
const settlementRows = computed(() =>
  settlements.items.value.map((item) => ({
    id: item.id,
    created: format.dateTime(item.created_at),
    items: item.items,
    total: format.money(item.total_amount),
    paid: item.status === 'PAID',
  })),
);

// ---- Confirming a payment: the cards of the settlement become sold, so it asks first
const settlementsApi = createSettlementsApi(useApi());
const confirming = ref<{ id: string; total: string } | null>(null);
const confirmBusy = ref(false);
const confirmError = ref<string | null>(null);

async function confirmPayment() {
  if (!confirming.value) return;
  confirmBusy.value = true;
  confirmError.value = null;
  try {
    await settlementsApi.markPaid(confirming.value.id);
    confirming.value = null;
    toast.success(t('customer.confirm.done'));
    await Promise.all(
      ['customer-settlements', 'customer-bids', 'inventory', 'home'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  } catch (error) {
    confirmError.value = errorMessage(error);
  } finally {
    confirmBusy.value = false;
  }
}

const bidColumns = computed<TableColumn[]>(() => [
  { key: 'when', label: t('customer.columns.date') },
  { key: 'card', label: t('customer.columns.card') },
  { key: 'amount', label: t('customer.columns.amount'), numeric: true },
  { key: 'result', label: t('customer.columns.result') },
]);
const bidRows = computed(() =>
  bids.items.value.map((item) => ({
    id: item.id,
    when: format.dateTime(item.created_at),
    code: item.card.short_code,
    card: item.card.name,
    auctionId: item.auction_id,
    amount: format.money(item.amount),
    won: item.won,
    over: item.auction_status === 'FINISHED' || item.auction_status === 'CANCELLED',
  })),
);
</script>

<template>
  <div class="stack">
    <AppState v-if="detail.isPending.value" kind="loading" :title="t('customer.loading')" />
    <AppState
      v-else-if="!customer"
      kind="error"
      :title="t('customer.error.title')"
      :text="errorMessage(detail.error.value)"
      :action-label="t('customer.error.retry')"
      @action="detail.refetch()"
    />

    <template v-else>
      <div class="crumb">
        <NuxtLink to="/customers">{{ t('nav.customers') }}</NuxtLink> / {{ customer.name }}
      </div>

      <div class="page-head">
        <h2>{{ customer.name }}</h2>
        <div class="row">
          <AppBadge v-if="customer.is_blacklisted" tone="danger">{{
            t('customers.blacklisted')
          }}</AppBadge>
          <AppBadge :tone="isIncomplete(customer) ? 'warning' : 'success'">
            {{ t(`customers.kinds.${customer.kind}`) }}
          </AppBadge>
        </div>
      </div>

      <div v-if="isIncomplete(customer)" class="alert alert--warning" role="status">
        <AppIcon name="alert" />
        <div class="alert__body">
          <p class="alert__title">{{ t('customer.incomplete.title') }}</p>
          <span class="muted">{{ t('customer.incomplete.text') }}</span>
        </div>
      </div>

      <form novalidate @submit.prevent="save">
        <AppCard
          as="section"
          :title="t('customer.data.title')"
          :aria-label="t('customer.data.title')"
          body-class="stack"
        >
          <template #head>
            <AppButton type="submit" variant="primary" size="sm" :busy="saving">
              {{ t('customer.data.save') }}
            </AppButton>
          </template>
          <div class="form-grid">
            <AppInput
              v-model="name"
              :label="t('customer.data.name')"
              :error="errors.name"
              name="name"
              autocomplete="off"
            />
            <AppInput
              :model-value="formatStoredPhone(customer.phone)"
              :label="t('customer.data.phone')"
              :hint="t('customer.data.phoneHint')"
              name="phone"
              disabled
            />
            <AppInput
              v-model="email"
              :label="t('customer.data.email')"
              :error="errors.email"
              type="email"
              name="email"
              autocomplete="off"
            />
            <AppInput
              v-model="cpf"
              :label="t('customer.data.cpf')"
              :error="errors.cpf"
              :hint="
                customer.cpf_masked
                  ? t('customer.data.cpfOnFile', { cpf: customer.cpf_masked })
                  : t('customer.data.cpfHint')
              "
              :placeholder="t('customer.data.cpfPlaceholder')"
              inputmode="numeric"
              name="cpf"
              autocomplete="off"
            />
            <AppInput
              v-model="zip"
              :label="t('customer.data.zip')"
              :error="errors.zip"
              :placeholder="t('customer.data.zipPlaceholder')"
              inputmode="numeric"
              name="zip"
              autocomplete="postal-code"
            />
            <AppInput
              v-model="street"
              :label="t('customer.data.street')"
              :error="errors.street"
              name="street"
              autocomplete="street-address"
            />
            <AppInput
              v-model="number"
              :label="t('customer.data.number')"
              :error="errors.number"
              name="number"
              autocomplete="off"
            />
            <AppInput
              v-model="comp"
              :label="t('customer.data.comp')"
              :error="errors.comp"
              name="comp"
              autocomplete="off"
            />
            <AppInput
              v-model="city"
              :label="t('customer.data.city')"
              :error="errors.city"
              name="city"
              autocomplete="address-level2"
            />
            <AppInput
              v-model="state"
              :label="t('customer.data.state')"
              :error="errors.state"
              maxlength="2"
              name="state"
              autocomplete="address-level1"
            />
          </div>
          <p v-if="saveError" role="alert" class="hint hint--error">{{ saveError }}</p>
        </AppCard>
      </form>

      <AppCard
        as="section"
        :title="t('customer.moderation.title')"
        :aria-label="t('customer.moderation.title')"
        body-class="stack"
      >
        <template v-if="customer.is_blacklisted">
          <p>
            <b>{{ t('customer.moderation.on') }}</b>
            <span v-if="customer.blacklist_reason" class="muted">
              · {{ customer.blacklist_reason }}</span
            >
          </p>
          <div class="row">
            <AppButton :busy="moderating" @click="unblock">{{
              t('customer.moderation.remove')
            }}</AppButton>
          </div>
        </template>
        <template v-else>
          <p class="muted">{{ t('customer.moderation.text') }}</p>
          <div class="row">
            <AppButton variant="danger" @click="askToBlock">{{
              t('customer.moderation.add')
            }}</AppButton>
          </div>
        </template>
        <p v-if="moderationError && !blocking" role="alert" class="hint hint--error">
          {{ moderationError }}
        </p>
      </AppCard>

      <AppTabs v-model="active" :tabs="tabs" :label="t('customer.tabs.label')">
        <template #default="{ active: current }">
          <AppCard
            v-if="current === 'settlements'"
            as="section"
            :aria-label="t('customer.tabs.settlements')"
          >
            <AppDataState
              :loading="settlements.isLoading.value"
              :error="settlements.isError.value"
              :empty="settlementRows.length === 0"
              :labels="{
                loading: t('customer.loadingList'),
                emptyTitle: t('customer.settlementsEmpty'),
                errorTitle: t('customer.errorList'),
                retry: t('customer.error.retry'),
              }"
              @retry="settlements.refetch()"
            >
              <AppTable
                :caption="t('customer.tabs.settlements')"
                :columns="settlementColumns"
                :rows="settlementRows"
                :row-key="(row) => row.id"
              >
                <template #cell-status="{ row }">
                  <AppBadge :tone="row.paid ? 'success' : 'warning'">
                    {{ row.paid ? t('customer.settlementPaid') : t('customer.settlementPending') }}
                  </AppBadge>
                </template>
                <template #cell-action="{ row }">
                  <AppButton
                    v-if="!row.paid"
                    size="sm"
                    @click="
                      confirmError = null;
                      confirming = { id: row.id, total: row.total };
                    "
                  >
                    {{ t('customer.confirm.action') }}
                  </AppButton>
                </template>
              </AppTable>
              <div v-if="settlements.hasNextPage.value" class="row customers__more card__foot">
                <AppButton
                  size="sm"
                  :busy="settlements.isFetchingNextPage.value"
                  @click="settlements.fetchNextPage()"
                >
                  {{ t('customers.loadMore') }}
                </AppButton>
              </div>
            </AppDataState>
          </AppCard>

          <ConsignmentWallet
            v-else-if="current === 'wallet'"
            :customer-id="customer.id"
            :name="customer.name"
            :phone="customer.phone"
            :has-cpf="customer.cpf_masked !== null"
          />

          <AppCard v-else as="section" :aria-label="t('customer.tabs.bids')">
            <AppDataState
              :loading="bids.isLoading.value"
              :error="bids.isError.value"
              :empty="bidRows.length === 0"
              :labels="{
                loading: t('customer.loadingList'),
                emptyTitle: t('customer.bidsEmpty'),
                errorTitle: t('customer.errorList'),
                retry: t('customer.error.retry'),
              }"
              @retry="bids.refetch()"
            >
              <AppTable
                :caption="t('customer.tabs.bids')"
                :columns="bidColumns"
                :rows="bidRows"
                :row-key="(row) => row.id"
              >
                <template #cell-card="{ row }">
                  <span class="id-chip">#{{ row.code }}</span>
                  <NuxtLink class="auctions__card" :to="`/auctions/${row.auctionId}`">{{
                    row.card
                  }}</NuxtLink>
                </template>
                <template #cell-result="{ row }">
                  <AppBadge v-if="row.won" tone="success">{{ t('customer.bidWon') }}</AppBadge>
                  <AppBadge v-else-if="row.over">{{ t('customer.bidLost') }}</AppBadge>
                  <AppBadge v-else tone="info">{{ t('customer.bidOpen') }}</AppBadge>
                </template>
              </AppTable>
              <div v-if="bids.hasNextPage.value" class="row customers__more card__foot">
                <AppButton
                  size="sm"
                  :busy="bids.isFetchingNextPage.value"
                  @click="bids.fetchNextPage()"
                >
                  {{ t('customers.loadMore') }}
                </AppButton>
              </div>
            </AppDataState>
          </AppCard>
        </template>
      </AppTabs>

      <AppModal
        :open="blocking"
        :title="t('customer.moderation.modal.title')"
        :close-label="t('customer.moderation.modal.close')"
        @close="blocking = false"
      >
        <div class="stack">
          <AppTextarea
            v-model="reason"
            :label="t('customer.moderation.modal.reason')"
            :error="reasonError"
            maxlength="300"
            name="reason"
          />
          <p class="muted">{{ t('customer.moderation.modal.text') }}</p>
          <p v-if="moderationError" role="alert" class="hint hint--error">{{ moderationError }}</p>
        </div>
        <template #foot>
          <AppButton @click="blocking = false">{{
            t('customer.moderation.modal.cancel')
          }}</AppButton>
          <AppButton variant="danger" :busy="moderating" @click="block">
            {{ t('customer.moderation.modal.confirm') }}
          </AppButton>
        </template>
      </AppModal>
    </template>

    <AppModal
      :open="confirming !== null"
      :title="t('customer.confirm.title')"
      :close-label="t('customer.confirm.close')"
      @close="confirming = null"
    >
      <div class="stack">
        <p>{{ t('customer.confirm.text', { total: confirming?.total ?? '' }) }}</p>
        <p v-if="confirmError" role="alert" class="hint hint--error">{{ confirmError }}</p>
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
