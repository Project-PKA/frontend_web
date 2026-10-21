<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { createAdminApi, type AdminUser } from '../../../api/admin';
import type { TableColumn } from '../../../components/AppTable.vue';
import {
  CREATE_FILTERS,
  STORE_LIMIT_MAX,
  USER_STATUSES,
  newUserSchema,
  parseStoreLimit,
  parseUserFilters,
  toApiUserFilters,
  userFiltersToAddress,
} from '../../../utils/admin-users';
import { useCursorList } from '../../../utils/cursor-list';

definePageMeta({
  i18n: false,
  layout: 'admin',
  titleKey: 'admin.users.title',
  access: { level: 'admin' },
});

const TONES = { ACTIVE: 'success', INVITED: 'warning', SUSPENDED: 'danger' } as const;
/** Wait for the person to stop typing before asking the API. */
const SEARCH_DELAY_MS = 300;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const format = useFormat();
const toast = useToast();
const errorMessage = useErrorMessage();
const queryClient = useQueryClient();
const api = createAdminApi(useApi());

// The filters live in the address (`/admin/users?status=SUSPENDED`): a reload keeps them.
const initial = parseUserFilters(route.query);
const search = ref(initial.q ?? '');
const query = ref(initial.q ?? '');
const status = ref<string>(initial.status ?? '');
const create = ref<string>(initial.create ?? '');

let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => (query.value = value.trim()), SEARCH_DELAY_MS);
});
onBeforeUnmount(() => clearTimeout(timer));

const filters = computed(() =>
  parseUserFilters({ q: query.value, status: status.value, create: create.value }),
);
watch(filters, (next) => void router.replace({ query: userFiltersToAddress(next) }));

const list = useCursorList({
  queryKey: () => ['admin', 'users', filters.value],
  fetchPage: (cursor, signal) => api.users(toApiUserFilters(filters.value), cursor, signal),
});

const filtered = computed(() => Object.keys(filters.value).length > 0);
function clearFilters() {
  search.value = '';
  query.value = '';
  status.value = '';
  create.value = '';
}

const columns = computed<TableColumn[]>(() => [
  { key: 'user', label: t('admin.users.columns.user') },
  { key: 'stores', label: t('admin.users.columns.stores'), numeric: true },
  { key: 'create', label: t('admin.users.columns.create') },
  { key: 'status', label: t('admin.users.columns.status') },
  { key: 'last', label: t('admin.users.columns.last') },
  { key: 'action', label: '' },
]);

function toRow(user: AdminUser) {
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email,
    stores: user.stores_count,
    admin: user.is_platform_admin,
    create: user.can_create_stores
      ? t('admin.users.createYes', { limit: user.store_limit })
      : t('admin.users.createNo'),
    canCreate: user.can_create_stores,
    status: user.status,
    last: user.last_login_at ? format.relative(user.last_login_at) : '',
  };
}
type Row = ReturnType<typeof toRow>;
const rows = computed(() => list.items.value.map(toRow));

// ---- Registering a user: the account is made by invitation
const registering = ref(false);
const name = ref('');
const email = ref('');
const canCreate = ref(false);
const limit = ref('0');
const errors = reactive<{ email: string | null; name: string | null; limit: string | null }>({
  email: null,
  name: null,
  limit: null,
});
const busy = ref(false);
const failure = ref<string | null>(null);

function openRegister() {
  name.value = '';
  email.value = '';
  canCreate.value = false;
  limit.value = '0';
  errors.email = errors.name = errors.limit = failure.value = null;
  registering.value = true;
}

async function register() {
  const parsed = newUserSchema.safeParse({ email: email.value, name: name.value });
  errors.email = errors.name = errors.limit = failure.value = null;
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === 'name' ? 'name' : 'email';
      errors[field] = t(issue.message);
    }
    return;
  }
  const storeLimit = parseStoreLimit(limit.value);
  if (storeLimit === null) {
    errors.limit = t('admin.users.errors.limit', { max: STORE_LIMIT_MAX });
    return;
  }
  busy.value = true;
  try {
    await api.createUser({
      email: parsed.data.email,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      can_create_stores: canCreate.value,
      store_limit: storeLimit,
    });
    registering.value = false;
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    toast.success(t('admin.users.invited', { email: parsed.data.email }));
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busy.value = false;
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
        :placeholder="t('admin.users.filters.search')"
        :aria-label="t('admin.users.filters.search')"
      />
      <select v-model="status" class="select" :aria-label="t('admin.users.filters.status')">
        <option value="">{{ t('admin.users.filters.statusAll') }}</option>
        <option v-for="item in USER_STATUSES" :key="item" :value="item">
          {{ t(`admin.users.status.${item}`) }}
        </option>
      </select>
      <select v-model="create" class="select" :aria-label="t('admin.users.filters.create')">
        <option value="">{{ t('admin.users.filters.createAll') }}</option>
        <option v-for="item in CREATE_FILTERS" :key="item" :value="item">
          {{ t(`admin.users.filters.create_${item}`) }}
        </option>
      </select>
      <div class="end">
        <AppButton variant="primary" @click="openRegister">
          <AppIcon name="plus" />
          {{ t('admin.users.register') }}
        </AppButton>
      </div>
    </div>

    <AppCard as="section" :aria-label="t('admin.users.caption')">
      <AppState v-if="list.isLoading.value" kind="loading" :title="t('admin.users.loading')" />
      <AppState
        v-else-if="list.isError.value"
        kind="error"
        :title="t('admin.users.error.title')"
        :text="t('admin.users.error.text')"
        :action-label="t('admin.users.error.retry')"
        @action="list.refetch()"
      />
      <AppState
        v-else-if="rows.length === 0 && !filtered"
        kind="empty"
        :title="t('admin.users.empty.title')"
        :text="t('admin.users.empty.text')"
      />
      <AppState
        v-else-if="rows.length === 0"
        kind="empty"
        :title="t('admin.users.noMatch.title')"
        :text="t('admin.users.noMatch.text')"
        :action-label="t('admin.users.noMatch.clear')"
        @action="clearFilters"
      />
      <template v-else>
        <AppTable
          :caption="t('admin.users.caption')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: Row) => row.id"
        >
          <template #cell-user="{ row }">
            <NuxtLink :to="`/admin/users/${row.id}`">{{ row.name || row.email }}</NuxtLink>
            <span v-if="row.name" class="mono faint admin__email">{{ row.email }}</span>
            <AppBadge v-if="row.admin" tone="primary">{{
              t('admin.users.platformAdmin')
            }}</AppBadge>
          </template>
          <template #cell-create="{ row }">
            <AppBadge v-if="row.canCreate" tone="primary">{{ row.create }}</AppBadge>
            <span v-else class="badge">{{ row.create }}</span>
          </template>
          <template #cell-status="{ row }">
            <AppBadge :tone="TONES[row.status]">{{
              t(`admin.users.status.${row.status}`)
            }}</AppBadge>
          </template>
          <template #cell-last="{ row }">
            <span v-if="row.last" class="mono">{{ row.last }}</span>
            <span v-else class="faint">{{ t('admin.users.never') }}</span>
          </template>
          <template #cell-action="{ row }">
            <AppButton
              :to="`/admin/users/${row.id}`"
              size="sm"
              :label="t('admin.users.manageAria', { who: row.name || row.email })"
            >
              {{ t('admin.users.manage') }}
            </AppButton>
          </template>
        </AppTable>
        <div v-if="list.hasNextPage.value" class="row customers__more card__foot">
          <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
            {{ t('admin.users.loadMore') }}
          </AppButton>
        </div>
        <div class="card__foot">{{ t('admin.users.note') }}</div>
      </template>
    </AppCard>

    <AppModal
      :open="registering"
      :title="t('admin.users.register')"
      :close-label="t('admin.close')"
      @close="registering = false"
    >
      <div class="stack">
        <AppInput
          v-model="name"
          :label="t('admin.users.form.name')"
          :error="errors.name"
          name="name"
          maxlength="120"
          autocomplete="off"
        />
        <AppInput
          v-model="email"
          :label="t('admin.users.form.email')"
          :error="errors.email"
          type="email"
          name="email"
          autocomplete="off"
          :placeholder="t('admin.users.form.emailPlaceholder')"
        />
        <AppSwitch v-model="canCreate" :disabled="busy">
          {{ t('admin.users.form.canCreate') }}
        </AppSwitch>
        <AppInput
          v-model="limit"
          :label="t('admin.users.form.limit')"
          :error="errors.limit"
          type="number"
          name="limit"
          min="0"
          :max="STORE_LIMIT_MAX"
        />
        <p class="muted">{{ t('admin.users.form.hint') }}</p>
        <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
      </div>
      <template #foot>
        <AppButton @click="registering = false">{{ t('admin.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="busy" @click="register">
          {{ t('admin.users.form.send') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
