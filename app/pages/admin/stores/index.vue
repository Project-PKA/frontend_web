<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { createAdminApi, type AdminStore, type AdminUser } from '../../../api/admin';
import type { TableColumn } from '../../../components/AppTable.vue';
import { useCursorList } from '../../../utils/cursor-list';

definePageMeta({
  i18n: false,
  layout: 'admin',
  titleKey: 'admin.stores.title',
  access: { level: 'admin' },
});

/** Wait for the person to stop typing before asking the API. */
const SEARCH_DELAY_MS = 300;

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();
const format = useFormat();
const toast = useToast();
const errorMessage = useErrorMessage();
const queryClient = useQueryClient();
const api = createAdminApi(useApi());

// The search lives in the address (`/admin/stores?q=hub`): a reload keeps it.
const first = Array.isArray(route.query.q) ? route.query.q[0] : route.query.q;
const search = ref(typeof first === 'string' ? first.slice(0, 80) : '');
const query = ref(search.value.trim());

let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => (query.value = value.trim()), SEARCH_DELAY_MS);
});
onBeforeUnmount(() => clearTimeout(timer));
watch(query, (value) => void router.replace({ query: value ? { q: value } : {} }));

const list = useCursorList({
  queryKey: () => ['admin', 'stores', query.value],
  fetchPage: (cursor, signal) => api.stores(query.value || undefined, cursor, signal),
});

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('admin.stores.columns.name') },
  { key: 'owner', label: t('admin.stores.columns.owner') },
  { key: 'plan', label: t('admin.stores.columns.plan') },
  { key: 'members', label: t('admin.stores.columns.members'), numeric: true },
  { key: 'whatsapp', label: t('admin.stores.columns.whatsapp') },
  { key: 'created', label: t('admin.stores.columns.created') },
  { key: 'action', label: '' },
]);

const planName = (code: string) => (te(`plan.names.${code}`) ? t(`plan.names.${code}`) : code);

function toRow(store: AdminStore) {
  return {
    id: store.id,
    name: store.name,
    city: store.city ?? '',
    owner: store.owner?.email ?? '',
    plan: planName(store.plan),
    members: `${store.members_count}`,
    memberLimit: store.member_limit,
    online: store.whatsapp_status === 'ONLINE',
    whatsapp: t(`whatsapp.${store.whatsapp_status}`),
    created: format.date(store.created_at),
  };
}
type Row = ReturnType<typeof toRow>;
const rows = computed(() => list.items.value.map(toRow));

// ---- Transferring the ownership: the new owner is an active account, found by name or e-mail
const transferring = ref<Row | null>(null);
const ownerText = ref('');
const chosen = ref<AdminUser | null>(null);
const search_ = useUserSearch(ownerText);
const busy = ref(false);
const failure = ref<string | null>(null);

function openTransfer(row: Row) {
  transferring.value = row;
  ownerText.value = '';
  chosen.value = null;
  failure.value = null;
}

function pick(user: AdminUser) {
  chosen.value = user;
  ownerText.value = user.email;
  failure.value = null;
}

async function transfer() {
  if (!transferring.value) return;
  if (!chosen.value) {
    failure.value = t('admin.stores.transfer.needsUser');
    return;
  }
  busy.value = true;
  failure.value = null;
  try {
    await api.transferOwnership(transferring.value.id, chosen.value.id);
    const email = chosen.value.email;
    transferring.value = null;
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    toast.success(t('admin.stores.transfer.done', { email }));
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

const searchLabels = computed(() => ({
  label: t('admin.stores.transfer.owner'),
  hint: t('admin.stores.transfer.hint'),
  loading: t('admin.stores.transfer.loading'),
  none: t('admin.stores.transfer.none', { text: ownerText.value }),
  error: t('admin.stores.transfer.error'),
  retry: t('admin.stores.transfer.retry'),
  count: t(
    'admin.stores.transfer.count',
    { count: search_.results.value.length },
    search_.results.value.length,
  ),
}));
</script>

<template>
  <div class="stack">
    <div class="filters" role="search">
      <input
        v-model="search"
        class="input grow"
        type="search"
        :placeholder="t('admin.stores.search')"
        :aria-label="t('admin.stores.search')"
      />
      <div class="end">
        <AppButton to="/admin/stores/new" variant="primary">
          <AppIcon name="plus" />
          {{ t('admin.stores.create') }}
        </AppButton>
      </div>
    </div>

    <AppCard as="section" :aria-label="t('admin.stores.caption')">
      <AppState v-if="list.isLoading.value" kind="loading" :title="t('admin.stores.loading')" />
      <AppState
        v-else-if="list.isError.value"
        kind="error"
        :title="t('admin.stores.error.title')"
        :text="t('admin.stores.error.text')"
        :action-label="t('admin.stores.error.retry')"
        @action="list.refetch()"
      />
      <AppState
        v-else-if="rows.length === 0"
        kind="empty"
        :title="query ? t('admin.stores.noMatch.title') : t('admin.stores.empty.title')"
        :text="query ? t('admin.stores.noMatch.text') : t('admin.stores.empty.text')"
      />
      <template v-else>
        <AppTable
          :caption="t('admin.stores.caption')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: Row) => row.id"
        >
          <template #cell-name="{ row }">
            <span>{{ row.name }}</span>
            <span v-if="row.city" class="faint admin__email">{{ row.city }}</span>
          </template>
          <template #cell-owner="{ row }">
            <span v-if="row.owner" class="mono">{{ row.owner }}</span>
            <span v-else class="faint">—</span>
          </template>
          <template #cell-plan="{ row }">
            <span class="badge">{{ row.plan }}</span>
          </template>
          <template #cell-members="{ row }">
            {{ t('admin.stores.membersOf', { used: row.members, limit: row.memberLimit }) }}
          </template>
          <template #cell-whatsapp="{ row }">
            <AppBadge :tone="row.online ? 'success' : 'danger'">{{ row.whatsapp }}</AppBadge>
          </template>
          <template #cell-created="{ row }">
            <span class="mono">{{ row.created }}</span>
          </template>
          <template #cell-action="{ row }">
            <AppButton
              size="sm"
              :label="t('admin.stores.transfer.aria', { store: row.name })"
              @click="openTransfer(row)"
            >
              {{ t('admin.stores.transfer.open') }}
            </AppButton>
          </template>
        </AppTable>
        <div v-if="list.hasNextPage.value" class="row customers__more card__foot">
          <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
            {{ t('admin.stores.loadMore') }}
          </AppButton>
        </div>
        <div class="card__foot">{{ t('admin.stores.note') }}</div>
      </template>
    </AppCard>

    <AppModal
      :open="transferring !== null"
      :title="t('admin.stores.transfer.title')"
      :close-label="t('admin.close')"
      @close="transferring = null"
    >
      <div class="stack">
        <p class="muted">
          {{ t('admin.stores.transfer.store') }} <b>{{ transferring?.name }}</b> ·
          {{ t('admin.stores.transfer.current') }}
          <span class="mono">{{ transferring?.owner || '—' }}</span>
        </p>
        <UserSearch
          v-model:query="ownerText"
          :results="search_.results.value"
          :loading="search_.loading.value"
          :error="search_.error.value"
          :labels="searchLabels"
          @select="pick"
          @retry="search_.retry()"
        />
        <p v-if="chosen" class="hint" role="status">
          {{ t('admin.stores.transfer.chosen', { email: chosen.email }) }}
        </p>
        <p class="muted">{{ t('admin.stores.transfer.text') }}</p>
        <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
      </div>
      <template #foot>
        <AppButton @click="transferring = null">{{ t('admin.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="busy" @click="transfer">
          {{ t('admin.stores.transfer.confirm') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
