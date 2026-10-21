<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createAdminApi } from '../../../api/admin';
import type { TableColumn } from '../../../components/AppTable.vue';
import { STORE_LIMIT_MAX, parseStoreLimit, toPermissionChanges } from '../../../utils/admin-users';

definePageMeta({
  i18n: false,
  layout: 'admin',
  titleKey: 'admin.user.title',
  access: { level: 'admin' },
});

const TONES = { ACTIVE: 'success', INVITED: 'warning', SUSPENDED: 'danger' } as const;

const { t } = useI18n();
const route = useRoute();
const format = useFormat();
const toast = useToast();
const errorMessage = useErrorMessage();
const queryClient = useQueryClient();
const api = createAdminApi(useApi());

const id = computed(() => String(route.params.id));
const detail = useQuery({
  queryKey: computed(() => ['admin', 'user', id.value]),
  queryFn: ({ signal }) => api.user(id.value, signal),
});
const user = computed(() => detail.data.value);

const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

// ---- The global permissions: only what changed is sent
const canCreate = ref(false);
const limit = ref('0');
watch(
  user,
  (value) => {
    if (!value) return;
    canCreate.value = value.can_create_stores;
    limit.value = String(value.store_limit);
  },
  { immediate: true },
);
const limitError = ref<string | null>(null);
const saving = ref(false);
const saveFailure = ref<string | null>(null);

async function save() {
  if (!user.value) return;
  const storeLimit = parseStoreLimit(limit.value);
  if (storeLimit === null) {
    limitError.value = t('admin.users.errors.limit', { max: STORE_LIMIT_MAX });
    return;
  }
  limitError.value = null;
  const changes = toPermissionChanges(user.value, { canCreate: canCreate.value, storeLimit });
  if (!changes) {
    toast.info(t('admin.user.nothingToSave'));
    return;
  }
  saving.value = true;
  saveFailure.value = null;
  try {
    await api.updatePermissions(user.value.id, changes);
    await refresh();
    toast.success(t('admin.user.saved'));
  } catch (error) {
    saveFailure.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

// ---- Access: send the invitation again, suspend or let back in
const resending = ref(false);
const resendFailure = ref<string | null>(null);

async function resend() {
  if (!user.value) return;
  resending.value = true;
  resendFailure.value = null;
  try {
    const invitation = await api.findPendingAccountInvitation(user.value.email);
    if (!invitation) {
      resendFailure.value = t('admin.user.noInvitation');
      return;
    }
    await api.resendInvitation(invitation.id);
    toast.success(t('admin.user.resent', { email: user.value.email }));
  } catch (error) {
    resendFailure.value = errorMessage(error);
  } finally {
    resending.value = false;
  }
}

const asking = ref<'suspend' | 'reactivate' | null>(null);
const askBusy = ref(false);
const askFailure = ref<string | null>(null);

function ask(kind: 'suspend' | 'reactivate') {
  asking.value = kind;
  askFailure.value = null;
}

async function confirmAccess() {
  if (!user.value || !asking.value) return;
  const kind = asking.value;
  askBusy.value = true;
  askFailure.value = null;
  try {
    await (kind === 'suspend' ? api.suspend(user.value.id) : api.reactivate(user.value.id));
    asking.value = null;
    await refresh();
    toast.success(t(`admin.user.${kind}.done`));
  } catch (error) {
    askFailure.value = errorMessage(error);
  } finally {
    askBusy.value = false;
  }
}

// ---- The stores of the user, read only
const storeColumns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('admin.user.stores.columns.name') },
  { key: 'role', label: t('admin.user.stores.columns.role') },
]);
const storeRows = computed(() =>
  (user.value?.stores ?? []).map((item) => ({ id: item.id, name: item.name, role: item.role })),
);
const displayName = computed(() => user.value?.name || user.value?.email || '');
</script>

<template>
  <div class="stack">
    <AppState v-if="detail.isPending.value" kind="loading" :title="t('admin.user.loading')" />
    <AppState
      v-else-if="!user"
      kind="error"
      :title="t('admin.user.error.title')"
      :text="errorMessage(detail.error.value)"
      :action-label="t('admin.user.error.retry')"
      @action="detail.refetch()"
    />

    <template v-else>
      <div class="crumb">
        <NuxtLink to="/admin/users">{{ t('admin.users.title') }}</NuxtLink> / {{ displayName }}
      </div>

      <div class="page-head">
        <h2>{{ displayName }}</h2>
        <div class="row">
          <AppBadge v-if="user.is_platform_admin" tone="primary">
            {{ t('admin.users.platformAdmin') }}
          </AppBadge>
          <AppBadge :tone="TONES[user.status]">{{
            t(`admin.users.status.${user.status}`)
          }}</AppBadge>
        </div>
      </div>

      <div class="cols-2">
        <div class="stack">
          <AppCard as="section" :aria-label="t('admin.user.data.title')">
            <div class="card__head">
              <h2 class="card__title">{{ t('admin.user.data.title') }}</h2>
            </div>
            <div class="card__body">
              <div class="form-grid">
                <AppInput
                  :model-value="user.name ?? ''"
                  :label="t('admin.user.data.name')"
                  disabled
                />
                <AppInput :model-value="user.email" :label="t('admin.user.data.email')" disabled />
                <AppInput
                  :model-value="format.dateTime(user.created_at)"
                  :label="t('admin.user.data.created')"
                  disabled
                />
                <AppInput
                  :model-value="
                    user.last_login_at
                      ? format.dateTime(user.last_login_at)
                      : t('admin.users.never')
                  "
                  :label="t('admin.user.data.last')"
                  disabled
                />
              </div>
            </div>
          </AppCard>

          <AppCard as="section" :aria-label="t('admin.user.permissions.title')">
            <div class="card__head">
              <h2 class="card__title">{{ t('admin.user.permissions.title') }}</h2>
            </div>
            <form class="card__body stack" novalidate @submit.prevent="save">
              <AppSwitch v-model="canCreate" :disabled="saving || user.is_platform_admin">
                {{ t('admin.users.form.canCreate') }}
              </AppSwitch>
              <AppInput
                v-model="limit"
                :label="t('admin.users.form.limit')"
                :error="limitError"
                type="number"
                name="limit"
                min="0"
                :max="STORE_LIMIT_MAX"
                :disabled="user.is_platform_admin"
              />
              <p class="muted">{{ t('admin.user.permissions.hint') }}</p>
              <p v-if="user.is_platform_admin" class="hint">
                {{ t('admin.user.permissions.adminFixed') }}
              </p>
              <p v-if="saveFailure" role="alert" class="hint hint--error">{{ saveFailure }}</p>
              <div class="row">
                <AppButton
                  type="submit"
                  variant="primary"
                  :busy="saving"
                  :disabled="user.is_platform_admin"
                >
                  {{ t('admin.user.save') }}
                </AppButton>
              </div>
            </form>
          </AppCard>
        </div>

        <div class="stack">
          <AppCard as="section" :aria-label="t('admin.user.stores.title')">
            <div class="card__head">
              <h2 class="card__title">{{ t('admin.user.stores.title') }}</h2>
            </div>
            <p v-if="storeRows.length === 0" class="card__body muted">
              {{ t('admin.user.stores.empty') }}
            </p>
            <AppTable
              v-else
              :caption="t('admin.user.stores.title')"
              :columns="storeColumns"
              :rows="storeRows"
              :row-key="(row) => row.id"
            >
              <template #cell-role="{ row }">
                <AppBadge v-if="row.role === 'OWNER'" tone="primary">{{
                  t('team.role.OWNER')
                }}</AppBadge>
                <span v-else class="badge">{{ t('team.role.STAFF') }}</span>
              </template>
            </AppTable>
            <div class="card__foot">{{ t('admin.user.stores.note') }}</div>
          </AppCard>

          <AppCard as="section" :aria-label="t('admin.user.access.title')">
            <div class="card__head">
              <h2 class="card__title">{{ t('admin.user.access.title') }}</h2>
            </div>
            <div class="card__body stack">
              <div class="row">
                <AppButton v-if="user.status === 'INVITED'" :busy="resending" @click="resend">
                  <AppIcon name="mail" />
                  {{ t('admin.user.resend') }}
                </AppButton>
                <AppButton
                  v-if="user.status === 'SUSPENDED'"
                  variant="primary"
                  @click="ask('reactivate')"
                >
                  {{ t('admin.user.reactivate.open') }}
                </AppButton>
                <AppButton
                  v-else-if="!user.is_platform_admin"
                  variant="danger"
                  @click="ask('suspend')"
                >
                  <AppIcon name="lock" />
                  {{ t('admin.user.suspend.open') }}
                </AppButton>
              </div>
              <p class="muted">{{ t('admin.user.access.hint') }}</p>
              <p v-if="resendFailure" role="alert" class="hint hint--error">{{ resendFailure }}</p>
            </div>
          </AppCard>
        </div>
      </div>
    </template>

    <AppModal
      :open="asking !== null"
      :title="
        t(asking === 'reactivate' ? 'admin.user.reactivate.title' : 'admin.user.suspend.title')
      "
      :close-label="t('admin.close')"
      @close="asking = null"
    >
      <div class="stack">
        <p>
          {{
            t(asking === 'reactivate' ? 'admin.user.reactivate.text' : 'admin.user.suspend.text', {
              who: displayName,
            })
          }}
        </p>
        <p v-if="askFailure" role="alert" class="hint hint--error">{{ askFailure }}</p>
      </div>
      <template #foot>
        <AppButton @click="asking = null">{{ t('admin.cancel') }}</AppButton>
        <AppButton
          :variant="asking === 'reactivate' ? 'primary' : 'danger'"
          :busy="askBusy"
          @click="confirmAccess"
        >
          {{
            t(
              asking === 'reactivate'
                ? 'admin.user.reactivate.confirm'
                : 'admin.user.suspend.confirm',
            )
          }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
