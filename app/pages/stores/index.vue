<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createStoresApi, type MyStore } from '../../api/stores';
import { canCreateStore } from '../../utils/store-limit';

definePageMeta({ i18n: false, layout: 'public', access: { level: 'session' } });

const { t } = useI18n();
const access = useAccessStore();
const api = createStoresApi(useApi());

useHead({ title: () => t('stores.title'), meta: [{ name: 'robots', content: 'noindex' }] });

const stores = useQuery({ queryKey: ['me', 'stores'], queryFn: () => api.listMine() });
const me = useQuery({
  queryKey: ['me'],
  queryFn: async () => {
    await access.loadMe();
    return access.me;
  },
});

const selected = ref(0);

const items = computed(() => stores.data.value?.items ?? []);
const offerNew = computed(
  () => me.data.value != null && canCreateStore(me.data.value, items.value),
);
const count = computed(() => items.value.length + (offerNew.value ? 1 : 0));

const loading = computed(() => stores.isPending.value || me.isPending.value);
const failed = computed(() => stores.isError.value || me.isError.value);

const labels = computed(() => ({
  loading: t('stores.loading'),
  emptyTitle: t('stores.empty.title'),
  emptyText: t('stores.empty.text'),
  errorTitle: t('stores.error.title'),
  errorText: t('stores.error.text'),
  retry: t('stores.error.retry'),
}));

function retry() {
  void stores.refetch();
  void me.refetch();
}

/**
 * The store of the card becomes the current one; the link then takes the person to the home.
 * A pointer click on a card that is not in the middle only brings it there (the deck does that),
 * so it does not choose; the keyboard (`detail` is 0) always chooses.
 */
function choose(store: MyStore, index: number, event: MouseEvent) {
  if (event.detail > 0 && index !== selected.value) return;
  access.selectStore(store.id);
}

const status = (store: MyStore) => ({
  on: store.whatsapp_status === 'ONLINE',
  text: t(`whatsapp.${store.whatsapp_status}`),
});
</script>

<template>
  <main id="main" class="center-page">
    <div class="stack store-picker">
      <h1 class="store-picker__title">{{ t('stores.title') }}</h1>

      <AppDataState
        :loading="loading"
        :error="failed"
        :empty="count === 0"
        :labels="labels"
        @retry="retry"
      >
        <StoreDeck
          v-model:selected="selected"
          :label="t('stores.list')"
          :previous-label="t('stores.previous')"
          :next-label="t('stores.next')"
          :count="count"
        >
          <StoreCard
            v-for="(store, index) in items"
            :key="store.id"
            to="/home"
            :name="store.name"
            :role-label="t(`role.${store.role}`)"
            :status="status(store)"
            :selected="index === selected"
            @select="choose(store, index, $event)"
          />
          <StoreCard
            v-if="offerNew"
            kind="new"
            to="/stores/new"
            :new-label="t('stores.newCard')"
            :selected="items.length === selected"
          />
        </StoreDeck>
      </AppDataState>
    </div>
  </main>
</template>
