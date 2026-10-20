<script setup lang="ts">
import { createCustomersApi, type Consignment, type ConsignmentPage } from '../api/customers';
import type { TableColumn } from './AppTable.vue';
import { useCursorList } from '../utils/cursor-list';
import { consignorLinkUrl, whatsappUrl } from '../utils/card-form';

/**
 * The wallet of a consignor: the cards they left with the store, what each one sold for, the
 * commission, and what is left to pass on to them. It also makes the link they follow their cards
 * with: the link (and its token) shows only once, when it is made, so it is shown right away to be
 * copied, opened as the consignor sees it, or sent on WhatsApp.
 */
const props = defineProps<{
  customerId: string;
  name: string;
  /** The phone as the API keeps it (digits with the country code), for the WhatsApp message. */
  phone: string;
  /** The link needs the CPF registered: the first 4 digits are the key to open it. */
  hasCpf: boolean;
}>();

const { t, te } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const api = createCustomersApi(useApi());

const totals = ref<ConsignmentPage['totals'] | null>(null);

const list = useCursorList<Consignment>({
  queryKey: () => ['consignments', access.storeId, props.customerId],
  fetchPage: async (cursor, signal) => {
    const page = await api.consignments(props.customerId, cursor, signal);
    totals.value = page.totals;
    return page;
  },
});

const columns = computed<TableColumn[]>(() => [
  { key: 'card', label: t('wallet.columns.card') },
  { key: 'status', label: t('wallet.columns.status') },
  { key: 'sold', label: t('wallet.columns.sold'), numeric: true },
  { key: 'commission', label: t('wallet.columns.commission'), numeric: true },
  { key: 'net', label: t('wallet.columns.net'), numeric: true },
]);

const money = (amount: string | null) => (amount === null ? '—' : format.money(amount));

const rows = computed(() =>
  list.items.value.map((item) => ({
    id: item.id,
    code: item.short_code,
    name: item.name,
    status: te(`inventory.status.${item.card_status}`)
      ? t(`inventory.status.${item.card_status}`)
      : item.card_status,
    sold: money(item.sale_amount),
    commission: item.commission_amount === null ? '—' : `− ${format.money(item.commission_amount)}`,
    net: money(item.net_amount),
  })),
);

// ---- The link the consignor follows their cards with
const creating = ref(false);
const failure = ref<string | null>(null);
const link = ref<{ url: string; whatsapp: string } | null>(null);

async function createLink() {
  creating.value = true;
  failure.value = null;
  try {
    const { token } = await api.createConsignorLink(props.customerId);
    const url = consignorLinkUrl(window.location.origin, token);
    link.value = {
      url,
      whatsapp: whatsappUrl(props.phone, t('wallet.link.message', { name: props.name, link: url })),
    };
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    creating.value = false;
  }
}

async function copyLink() {
  if (!link.value) return;
  try {
    await navigator.clipboard.writeText(link.value.url);
    toast.info(t('wallet.link.copied'));
  } catch {
    toast.error(t('wallet.link.copyFailed'));
  }
}
</script>

<template>
  <AppCard as="section" :aria-label="t('wallet.title')">
    <AppDataState
      :loading="list.isLoading.value"
      :error="list.isError.value"
      :empty="rows.length === 0"
      :labels="{
        loading: t('wallet.loading'),
        emptyTitle: t('wallet.empty.title'),
        emptyText: t('wallet.empty.text'),
        errorTitle: t('wallet.error'),
        retry: t('wallet.retry'),
      }"
      @retry="list.refetch()"
    >
      <dl v-if="totals" class="wallet__totals">
        <div>
          <dt>{{ t('wallet.totals.inStock') }}</dt>
          <dd>{{ totals.in_stock }}</dd>
        </div>
        <div>
          <dt>{{ t('wallet.totals.pending') }}</dt>
          <dd>{{ format.money(totals.pending_net) }}</dd>
        </div>
        <div>
          <dt>{{ t('wallet.totals.paid') }}</dt>
          <dd>{{ format.money(totals.sold_net) }}</dd>
        </div>
        <div>
          <dt>{{ t('wallet.totals.commission') }}</dt>
          <dd>{{ format.money(totals.commission) }}</dd>
        </div>
      </dl>

      <AppTable
        :caption="t('wallet.title')"
        :columns="columns"
        :rows="rows"
        :row-key="(row) => row.id"
      >
        <template #cell-card="{ row }">
          <span class="id-chip">#{{ row.code }}</span>
          <span class="auctions__card">{{ row.name }}</span>
        </template>
        <template #cell-net="{ row }">
          <b>{{ row.net }}</b>
        </template>
      </AppTable>
      <div v-if="list.hasNextPage.value" class="row customers__more card__foot">
        <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
          {{ t('customers.loadMore') }}
        </AppButton>
      </div>
    </AppDataState>

    <div class="card__body stack wallet__link">
      <b>{{ t('wallet.link.title') }}</b>
      <p class="muted">{{ hasCpf ? t('wallet.link.text') : t('wallet.link.needsCpf') }}</p>

      <div v-if="link" class="card consignor-link">
        <div class="card__body stack">
          <span class="mono consignor-link__url">{{ link.url }}</span>
          <span class="muted">{{ t('wallet.link.key') }}</span>
          <div class="row">
            <AppButton size="sm" @click="copyLink">
              <AppIcon name="copy" />
              {{ t('wallet.link.copy') }}
            </AppButton>
            <a
              class="btn btn--secondary btn--sm"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="external" />
              {{ t('wallet.link.view') }}
            </a>
            <a
              class="btn btn--secondary btn--sm"
              :href="link.whatsapp"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="message" />
              {{ t('wallet.link.whatsapp') }}
            </a>
          </div>
        </div>
      </div>

      <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
      <div class="row">
        <AppButton :busy="creating" :disabled="!hasCpf" @click="createLink">
          {{ link ? t('wallet.link.again') : t('wallet.link.create') }}
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>
