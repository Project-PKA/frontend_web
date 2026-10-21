<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createAdminApi } from '../../api/admin';
import type { TableColumn } from '../../components/AppTable.vue';

definePageMeta({
  i18n: false,
  layout: 'admin',
  titleKey: 'admin.dashboard.title',
  access: { level: 'admin' },
});

const { t, te } = useI18n();
const format = useFormat();
const api = createAdminApi(useApi());

const dashboard = useQuery({
  queryKey: ['admin', 'dashboard'],
  queryFn: ({ signal }) => api.dashboard(signal),
});
const requests = useQuery({
  queryKey: ['admin', 'access-requests', 'PENDING', 'dashboard'],
  queryFn: ({ signal }) => api.accessRequests('PENDING', undefined, signal),
});

const kpis = computed(() => dashboard.data.value?.kpis);

const requestColumns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('admin.dashboard.requests.columns.name') },
  { key: 'store', label: t('admin.dashboard.requests.columns.store') },
  { key: 'when', label: t('admin.dashboard.requests.columns.when') },
]);
const requestRows = computed(() =>
  (requests.data.value?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    store: item.store_name,
    when: format.relative(item.created_at),
  })),
);

const storeColumns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('admin.dashboard.stores.columns.name') },
  { key: 'city', label: t('admin.dashboard.stores.columns.city') },
  { key: 'status', label: t('admin.dashboard.stores.columns.status') },
]);
const storeRows = computed(() =>
  (dashboard.data.value?.disconnected_stores ?? [])
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id ?? '',
      name: item.name ?? '',
      city: item.city ?? '',
      status: item.whatsapp_status ?? '',
    })),
);
const statusText = (status: string) =>
  te(`whatsapp.${status}`) ? t(`whatsapp.${status}`) : status;
</script>

<template>
  <div class="stack">
    <AppState
      v-if="dashboard.isPending.value"
      kind="loading"
      :title="t('admin.dashboard.loading')"
    />
    <AppState
      v-else-if="dashboard.isError.value || !kpis"
      kind="error"
      :title="t('admin.dashboard.error.title')"
      :text="t('admin.dashboard.error.text')"
      :action-label="t('admin.dashboard.error.retry')"
      @action="dashboard.refetch()"
    />

    <template v-else>
      <div class="grid grid--kpi">
        <AppKpi icon="users" :value="kpis.active_users" :label="t('admin.dashboard.kpi.users')" />
        <AppKpi icon="store" :value="kpis.stores" :label="t('admin.dashboard.kpi.stores')" />
        <AppKpi
          icon="mail"
          :value="kpis.pending_invitations"
          :label="t('admin.dashboard.kpi.invitations')"
        >
          <template #badge>
            <AppBadge tone="warning">{{ t('admin.dashboard.kpi.waiting') }}</AppBadge>
          </template>
        </AppKpi>
        <AppKpi
          icon="message"
          :value="kpis.new_access_requests"
          :label="t('admin.dashboard.kpi.requests')"
        >
          <template #badge>
            <AppBadge tone="primary">{{ t('admin.dashboard.kpi.new') }}</AppBadge>
          </template>
        </AppKpi>
        <AppKpi
          icon="chart"
          :value="kpis.pending_plan_requests"
          :label="t('admin.dashboard.kpi.plans')"
        >
          <template #badge>
            <AppBadge tone="warning">{{ t('admin.dashboard.kpi.waiting') }}</AppBadge>
          </template>
        </AppKpi>
      </div>

      <div class="cols-2">
        <AppCard as="section" :aria-label="t('admin.dashboard.requests.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('admin.dashboard.requests.title') }}</h2>
          </div>
          <p v-if="requests.isPending.value" class="card__body muted">
            {{ t('admin.dashboard.loading') }}
          </p>
          <p v-else-if="requests.isError.value" role="alert" class="card__body hint hint--error">
            {{ t('admin.dashboard.requests.error') }}
          </p>
          <p v-else-if="requestRows.length === 0" class="card__body muted">
            {{ t('admin.dashboard.requests.empty') }}
          </p>
          <AppTable
            v-else
            :caption="t('admin.dashboard.requests.title')"
            :columns="requestColumns"
            :rows="requestRows"
            :row-key="(row) => row.id"
          />
        </AppCard>

        <AppCard as="section" :aria-label="t('admin.dashboard.stores.title')">
          <div class="card__head">
            <h2 class="card__title">{{ t('admin.dashboard.stores.title') }}</h2>
          </div>
          <p v-if="storeRows.length === 0" class="card__body muted">
            {{ t('admin.dashboard.stores.empty') }}
          </p>
          <AppTable
            v-else
            :caption="t('admin.dashboard.stores.title')"
            :columns="storeColumns"
            :rows="storeRows"
            :row-key="(row) => row.id"
          >
            <template #cell-city="{ row }">
              <span v-if="row.city">{{ row.city }}</span>
              <span v-else class="faint">—</span>
            </template>
            <template #cell-status="{ row }">
              <AppBadge tone="danger">{{ statusText(row.status) }}</AppBadge>
            </template>
          </AppTable>
          <div class="card__foot">{{ t('admin.dashboard.stores.note') }}</div>
        </AppCard>
      </div>
    </template>
  </div>
</template>
