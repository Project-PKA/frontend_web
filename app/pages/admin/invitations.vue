<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { createAdminApi, type AccessRequest, type AdminInvitation } from '../../api/admin';
import type { TableColumn } from '../../components/AppTable.vue';
import { useCursorList } from '../../utils/cursor-list';
import { formatStoredPhone } from '../../utils/phone';

definePageMeta({
  i18n: false,
  layout: 'admin',
  titleKey: 'admin.invitations.title',
  access: { level: 'admin' },
});

const TONES = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'danger',
  EXPIRED: 'danger',
} as const;
const STATES = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const;
const KINDS = ['ACCOUNT', 'OWNER', 'STAFF'] as const;

const { t } = useI18n();
const format = useFormat();
const toast = useToast();
const errorMessage = useErrorMessage();
const queryClient = useQueryClient();
const api = createAdminApi(useApi());

const active = ref('invitations');
const tabs = computed(() => [
  { id: 'invitations', label: t('admin.invitations.tabs.invitations') },
  { id: 'requests', label: t('admin.invitations.tabs.requests') },
]);

const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

// ---- Invitations sent
const state = ref<string>('');
const kind = ref<string>('');
const invitations = useCursorList({
  queryKey: () => ['admin', 'invitations', state.value, kind.value],
  fetchPage: (cursor, signal) =>
    api.invitations(
      {
        ...(state.value ? { status: state.value as AdminInvitation['state'] } : {}),
        ...(kind.value ? { kind: kind.value as AdminInvitation['kind'] } : {}),
      },
      cursor,
      signal,
    ),
  enabled: () => active.value === 'invitations',
});

const inviteColumns = computed<TableColumn[]>(() => [
  { key: 'email', label: t('admin.invitations.columns.email') },
  { key: 'kind', label: t('admin.invitations.columns.kind') },
  { key: 'store', label: t('admin.invitations.columns.store') },
  { key: 'sent', label: t('admin.invitations.columns.sent') },
  { key: 'expires', label: t('admin.invitations.columns.expires') },
  { key: 'state', label: t('admin.invitations.columns.state') },
  { key: 'action', label: '' },
]);
const inviteRows = computed(() =>
  invitations.items.value.map((item: AdminInvitation) => ({
    id: item.id,
    email: item.email,
    kind: item.kind,
    store: item.store?.name ?? '',
    sent: format.relative(item.created_at),
    expires: item.state === 'ACCEPTED' ? '' : format.relative(item.expires_at),
    state: item.state,
  })),
);
type InviteRow = (typeof inviteRows.value)[number];

const busyId = ref<string | null>(null);
async function resend(row: InviteRow) {
  busyId.value = row.id;
  try {
    await api.resendInvitation(row.id);
    await refresh();
    toast.success(t('admin.invitations.resent', { email: row.email }));
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    busyId.value = null;
  }
}

// ---- Access requests
const requests = useCursorList({
  queryKey: () => ['admin', 'access-requests', 'PENDING', 'page'],
  fetchPage: (cursor, signal) => api.accessRequestPage('PENDING', cursor, signal),
  enabled: () => active.value === 'requests',
});
const requestColumns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('admin.invitations.requests.columns.name') },
  { key: 'email', label: t('admin.invitations.requests.columns.email') },
  { key: 'whatsapp', label: t('admin.invitations.requests.columns.whatsapp') },
  { key: 'store', label: t('admin.invitations.requests.columns.store') },
  { key: 'when', label: t('admin.invitations.requests.columns.when') },
  { key: 'action', label: '' },
]);
const requestRows = computed(() =>
  requests.items.value.map((item: AccessRequest) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    whatsapp: item.whatsapp ? formatStoredPhone(item.whatsapp) : '',
    store: item.store_name,
    when: format.relative(item.created_at),
  })),
);
type RequestRow = (typeof requestRows.value)[number];

// ---- Revoking an invitation and refusing a request both ask first
const asking = ref<{ type: 'revoke'; row: InviteRow } | { type: 'refuse'; row: RequestRow } | null>(
  null,
);
const askBusy = ref(false);
const askFailure = ref<string | null>(null);

function ask(type: 'revoke', row: InviteRow): void;
function ask(type: 'refuse', row: RequestRow): void;
function ask(type: 'revoke' | 'refuse', row: InviteRow | RequestRow) {
  askFailure.value = null;
  asking.value = { type, row } as typeof asking.value;
}

async function confirm() {
  const current = asking.value;
  if (!current) return;
  askBusy.value = true;
  askFailure.value = null;
  try {
    if (current.type === 'revoke') await api.revokeInvitation(current.row.id);
    else await api.refuseAccessRequest(current.row.id);
    asking.value = null;
    await refresh();
    toast.success(t(`admin.invitations.${current.type}.done`));
  } catch (error) {
    askFailure.value = errorMessage(error);
  } finally {
    askBusy.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <AppTabs v-model="active" :tabs="tabs" :label="t('admin.invitations.tabs.label')">
      <template #default="{ active: current }">
        <div v-if="current === 'invitations'" class="stack">
          <div class="filters">
            <select
              v-model="state"
              class="select"
              :aria-label="t('admin.invitations.filters.state')"
            >
              <option value="">{{ t('admin.invitations.filters.stateAll') }}</option>
              <option v-for="item in STATES" :key="item" :value="item">
                {{ t(`admin.invitations.state.${item}`) }}
              </option>
            </select>
            <select v-model="kind" class="select" :aria-label="t('admin.invitations.filters.kind')">
              <option value="">{{ t('admin.invitations.filters.kindAll') }}</option>
              <option v-for="item in KINDS" :key="item" :value="item">
                {{ t(`admin.invitations.kind.${item}`) }}
              </option>
            </select>
          </div>

          <AppCard as="section" :aria-label="t('admin.invitations.tabs.invitations')">
            <AppDataState
              :loading="invitations.isLoading.value"
              :error="invitations.isError.value"
              :empty="inviteRows.length === 0"
              :labels="{
                loading: t('admin.invitations.loading'),
                emptyTitle: t('admin.invitations.empty'),
                errorTitle: t('admin.invitations.error'),
                retry: t('admin.invitations.retry'),
              }"
              @retry="invitations.refetch()"
            >
              <AppTable
                :caption="t('admin.invitations.tabs.invitations')"
                :columns="inviteColumns"
                :rows="inviteRows"
                :row-key="(row: InviteRow) => row.id"
              >
                <template #cell-email="{ row }">
                  <span class="mono">{{ row.email }}</span>
                </template>
                <template #cell-kind="{ row }">{{
                  t(`admin.invitations.kind.${row.kind}`)
                }}</template>
                <template #cell-store="{ row }">
                  <span v-if="row.store">{{ row.store }}</span>
                  <span v-else class="faint">—</span>
                </template>
                <template #cell-sent="{ row }"
                  ><span class="mono">{{ row.sent }}</span></template
                >
                <template #cell-expires="{ row }">
                  <span v-if="row.expires" class="mono">{{ row.expires }}</span>
                  <span v-else class="faint">—</span>
                </template>
                <template #cell-state="{ row }">
                  <AppBadge :tone="TONES[row.state as keyof typeof TONES]">
                    {{ t(`admin.invitations.state.${row.state}`) }}
                  </AppBadge>
                </template>
                <template #cell-action="{ row }">
                  <div v-if="row.state === 'PENDING' || row.state === 'EXPIRED'" class="row">
                    <AppButton
                      size="sm"
                      :busy="busyId === row.id"
                      :label="t('admin.invitations.resendAria', { email: row.email })"
                      @click="resend(row)"
                    >
                      {{ t('admin.invitations.resend') }}
                    </AppButton>
                    <AppButton
                      v-if="row.state === 'PENDING'"
                      size="sm"
                      variant="ghost"
                      :label="t('admin.invitations.revokeAria', { email: row.email })"
                      @click="ask('revoke', row)"
                    >
                      {{ t('admin.invitations.revoke.open') }}
                    </AppButton>
                  </div>
                </template>
              </AppTable>
              <div v-if="invitations.hasNextPage.value" class="row customers__more card__foot">
                <AppButton
                  size="sm"
                  :busy="invitations.isFetchingNextPage.value"
                  @click="invitations.fetchNextPage()"
                >
                  {{ t('admin.invitations.loadMore') }}
                </AppButton>
              </div>
            </AppDataState>
          </AppCard>
        </div>

        <AppCard v-else as="section" :aria-label="t('admin.invitations.tabs.requests')">
          <AppDataState
            :loading="requests.isLoading.value"
            :error="requests.isError.value"
            :empty="requestRows.length === 0"
            :labels="{
              loading: t('admin.invitations.loading'),
              emptyTitle: t('admin.invitations.requests.empty'),
              errorTitle: t('admin.invitations.error'),
              retry: t('admin.invitations.retry'),
            }"
            @retry="requests.refetch()"
          >
            <AppTable
              :caption="t('admin.invitations.tabs.requests')"
              :columns="requestColumns"
              :rows="requestRows"
              :row-key="(row: RequestRow) => row.id"
            >
              <template #cell-email="{ row }"
                ><span class="mono">{{ row.email }}</span></template
              >
              <template #cell-whatsapp="{ row }">
                <span v-if="row.whatsapp" class="mono">{{ row.whatsapp }}</span>
                <span v-else class="faint">—</span>
              </template>
              <template #cell-when="{ row }"
                ><span class="mono">{{ row.when }}</span></template
              >
              <template #cell-action="{ row }">
                <div class="row">
                  <AppButton
                    :to="`/admin/stores/new?request=${row.id}`"
                    variant="primary"
                    size="sm"
                    :label="t('admin.invitations.requests.createAria', { name: row.name })"
                  >
                    {{ t('admin.invitations.requests.create') }}
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    :label="t('admin.invitations.refuse.aria', { name: row.name })"
                    @click="ask('refuse', row)"
                  >
                    {{ t('admin.invitations.refuse.open') }}
                  </AppButton>
                </div>
              </template>
            </AppTable>
            <div v-if="requests.hasNextPage.value" class="row customers__more card__foot">
              <AppButton
                size="sm"
                :busy="requests.isFetchingNextPage.value"
                @click="requests.fetchNextPage()"
              >
                {{ t('admin.invitations.loadMore') }}
              </AppButton>
            </div>
            <div class="card__foot">{{ t('admin.invitations.requests.note') }}</div>
          </AppDataState>
        </AppCard>
      </template>
    </AppTabs>

    <AppModal
      :open="asking !== null"
      :title="
        t(
          asking?.type === 'refuse'
            ? 'admin.invitations.refuse.title'
            : 'admin.invitations.revoke.title',
        )
      "
      :close-label="t('admin.close')"
      @close="asking = null"
    >
      <div class="stack">
        <p>
          {{
            asking?.type === 'refuse'
              ? t('admin.invitations.refuse.text', { name: (asking.row as RequestRow).name })
              : t('admin.invitations.revoke.text', {
                  email: asking ? (asking.row as InviteRow).email : '',
                })
          }}
        </p>
        <p v-if="askFailure" role="alert" class="hint hint--error">{{ askFailure }}</p>
      </div>
      <template #foot>
        <AppButton @click="asking = null">{{ t('admin.cancel') }}</AppButton>
        <AppButton variant="danger" :busy="askBusy" @click="confirm">
          {{
            t(
              asking?.type === 'refuse'
                ? 'admin.invitations.refuse.confirm'
                : 'admin.invitations.revoke.confirm',
            )
          }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
