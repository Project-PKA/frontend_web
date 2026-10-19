<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createInventoryApi, type CardDetail } from '../../api/inventory';
import type { TableColumn } from '../../components/AppTable.vue';
import { auctionResult, cardTitle, resultTone, statusTone } from '../../utils/inventory';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'inventory.detail.title',
  access: { level: 'store', permission: 'can_manage_inventory' },
});

const { t, te } = useI18n();
const route = useRoute();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createInventoryApi(useApi());

const id = computed(() => String(route.params.id));

const detail = useQuery({
  queryKey: computed(() => ['card', access.storeId, id.value]),
  queryFn: ({ signal }) => api.get(id.value, signal),
});

const card = computed(() => detail.data.value?.card);
const auctions = computed(() => detail.data.value?.auctions ?? []);

const title = computed(() => (card.value ? cardTitle(card.value.catalog) : ''));

useHead({ title: () => (title.value ? `${title.value} · ${t('inventory.detail.title')}` : null) });

function languageName(code: string): string {
  const key = `inventory.languages.${code.toUpperCase()}`;
  return te(key) ? t(key) : code.toUpperCase();
}

// ---- Deleting: only an available card that never went to an auction, and only with permission.
const canDelete = computed(() => access.can('can_delete'));
const deletable = computed(() => card.value?.status === 'AVAILABLE' && auctions.value.length === 0);
const deleteHint = computed(() => {
  if (!canDelete.value) return t('inventory.detail.delete.needsPermission');
  if (!deletable.value) return t('inventory.detail.delete.cannot');
  return undefined;
});
const confirming = ref(false);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

function askToDelete() {
  deleteError.value = null;
  confirming.value = true;
}

async function remove() {
  deleting.value = true;
  deleteError.value = null;
  try {
    await api.remove(id.value);
    confirming.value = false;
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    toast.success(t('inventory.detail.delete.done'));
    await navigateTo('/inventory');
  } catch (error) {
    deleteError.value = errorMessage(error);
  } finally {
    deleting.value = false;
  }
}

// ---- Auction history
const historyColumns = computed<TableColumn[]>(() => [
  { key: 'when', label: t('inventory.detail.history.columns.date') },
  { key: 'type', label: t('inventory.detail.history.columns.type') },
  { key: 'highestBid', label: t('inventory.detail.history.columns.highestBid'), numeric: true },
  { key: 'result', label: t('inventory.detail.history.columns.result') },
]);

function historyRow(auction: CardDetail['auctions'][number]) {
  const result = auctionResult(auction);
  return {
    id: auction.id,
    when: format.date(auction.start_time),
    type: te(`inventory.detail.history.types.${auction.type}`)
      ? t(`inventory.detail.history.types.${auction.type}`)
      : auction.type,
    highestBid: auction.winning_amount === null ? '' : format.money(auction.winning_amount),
    result,
  };
}
type HistoryRow = ReturnType<typeof historyRow>;
const history = computed(() => auctions.value.map(historyRow));
</script>

<template>
  <div class="stack">
    <AppState v-if="detail.isPending.value" kind="loading" :title="t('inventory.detail.loading')" />
    <AppState
      v-else-if="!card"
      kind="error"
      :title="t('inventory.detail.error.title')"
      :text="errorMessage(detail.error.value)"
      :action-label="t('inventory.detail.error.retry')"
      @action="detail.refetch()"
    />

    <template v-else>
      <div class="crumb">
        <NuxtLink to="/inventory">{{ t('nav.inventory') }}</NuxtLink> / #{{ card.short_code }}
      </div>

      <div class="page-head">
        <h2>{{ title }}</h2>
        <div class="row">
          <AppButton
            variant="danger"
            :disabled="!canDelete || !deletable"
            :title="deleteHint"
            @click="askToDelete"
          >
            <AppIcon name="trash" />
            {{ t('inventory.detail.delete.button') }}
          </AppButton>
        </div>
      </div>
      <p v-if="deleteHint" class="muted inventory__hint">{{ deleteHint }}</p>

      <div class="cols-2 cols-2--stretch">
        <AppCard
          as="section"
          :title="t('inventory.detail.data')"
          :aria-label="t('inventory.detail.data')"
          body-class="stack"
        >
          <dl class="kv">
            <dt>{{ t('inventory.columns.id') }}</dt>
            <dd>
              <span class="id-chip">#{{ card.short_code }}</span>
            </dd>
            <dt>{{ t('inventory.columns.set') }}</dt>
            <dd>{{ card.catalog.set_name }}</dd>
            <dt>{{ t('inventory.detail.number') }}</dt>
            <dd class="mono">{{ card.catalog.number }}</dd>
            <dt>{{ t('inventory.columns.language') }}</dt>
            <dd>{{ languageName(card.language) }}</dd>
            <dt>{{ t('inventory.columns.condition') }}</dt>
            <dd>{{ t(`inventory.conditions.${card.condition}`) }}</dd>
            <dt>{{ t('inventory.detail.foil') }}</dt>
            <dd>
              {{ card.is_foil ? t('inventory.detail.yes') : t('inventory.detail.no') }}
            </dd>
            <dt>{{ t('inventory.columns.origin') }}</dt>
            <dd>
              <AppBadge :tone="card.origin === 'OWN' ? 'dashed' : 'primary'">
                {{ t(`inventory.origin.${card.origin}`) }}
              </AppBadge>
            </dd>
            <template v-if="card.consignor">
              <dt>{{ t('inventory.detail.consignor') }}</dt>
              <dd>
                {{ card.consignor.name }}
                <span v-if="card.commission_pct" class="muted">
                  · {{ t('inventory.detail.commission', { pct: card.commission_pct }) }}
                </span>
              </dd>
            </template>
            <dt>{{ t('inventory.columns.status') }}</dt>
            <dd>
              <AppBadge :tone="statusTone(card.status)">
                {{ t(`inventory.status.${card.status}`) }}
              </AppBadge>
            </dd>
            <dt>{{ t('inventory.detail.registered') }}</dt>
            <dd class="mono">{{ format.date(card.created_at) }}</dd>
          </dl>

          <div>
            <span class="label">{{ t('inventory.detail.photos') }}</span>
            <div v-if="card.photos.length > 0" class="photos inventory__photos">
              <CardPhoto
                v-for="(photo, index) in card.photos"
                :key="photo"
                :card-id="card.id"
                :photo-id="photo"
                :alt="t('inventory.detail.photoAlt', { n: index + 1, name: title })"
                :loading-text="t('inventory.detail.photoLoading')"
                :error-text="t('inventory.detail.photoError')"
              />
            </div>
            <p v-else class="muted">{{ t('inventory.detail.noPhotos') }}</p>
          </div>

          <div>
            <span class="label">{{ t('inventory.detail.notes') }}</span>
            <p v-if="card.notes" class="inventory__notes">{{ card.notes }}</p>
            <p v-else class="muted">{{ t('inventory.detail.noNotes') }}</p>
          </div>
        </AppCard>

        <AppCard
          as="section"
          :title="t('inventory.detail.history.title')"
          :aria-label="t('inventory.detail.history.title')"
        >
          <AppState
            v-if="history.length === 0"
            kind="empty"
            :title="t('inventory.detail.history.empty')"
          />
          <AppTable
            v-else
            :caption="t('inventory.detail.history.title')"
            :columns="historyColumns"
            :rows="history"
            :row-key="(row: HistoryRow) => row.id"
          >
            <template #cell-when="{ row }">
              <NuxtLink class="mono" :to="`/auctions/${row.id}`">{{ row.when }}</NuxtLink>
            </template>
            <template #cell-result="{ row }">
              <AppBadge :tone="resultTone(row.result)" :live="row.result === 'active'">
                {{ t(`inventory.detail.history.results.${row.result}`) }}
              </AppBadge>
            </template>
          </AppTable>
          <template #foot>{{ t('inventory.detail.history.foot') }}</template>
        </AppCard>
      </div>

      <AppModal
        :open="confirming"
        :title="t('inventory.detail.delete.title')"
        :close-label="t('inventory.detail.delete.close')"
        @close="confirming = false"
      >
        <p>
          {{
            t('inventory.detail.delete.text', {
              code: `#${card.short_code}`,
              name: title,
            })
          }}
        </p>
        <p v-if="deleteError" role="alert" class="hint hint--error">{{ deleteError }}</p>
        <template #foot>
          <AppButton @click="confirming = false">{{
            t('inventory.detail.delete.cancel')
          }}</AppButton>
          <AppButton variant="danger" :busy="deleting" @click="remove">
            {{ t('inventory.detail.delete.confirm') }}
          </AppButton>
        </template>
      </AppModal>
    </template>
  </div>
</template>
