<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createTeamApi } from '../../api/team';
import type { TableColumn } from '../../components/AppTable.vue';
import { PERMISSIONS, type Permission } from '../../utils/permissions';
import {
  DEFAULT_CHOICE,
  granted,
  inviteSchema,
  teamRows,
  toChoice,
  type TeamRow,
} from '../../utils/team';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.team',
  access: { level: 'store', owner: true },
});

const { t } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createTeamApi(useApi());

const members = useQuery({
  queryKey: computed(() => ['team', access.storeId, 'members']),
  queryFn: ({ signal }) => api.list(signal),
});
const invitations = useQuery({
  queryKey: computed(() => ['team', access.storeId, 'invitations']),
  queryFn: ({ signal }) => api.invitations(signal),
});

const rows = computed(() =>
  teamRows(members.data.value?.items ?? [], invitations.data.value?.items ?? []),
);

const labels = computed(
  () =>
    Object.fromEntries(PERMISSIONS.map((item) => [item, t(`permissions.${item}`)])) as Record<
      Permission,
      string
    >,
);

const columns = computed<TableColumn[]>(() => [
  { key: 'member', label: t('team.columns.member') },
  { key: 'role', label: t('team.columns.role') },
  { key: 'permissions', label: t('team.columns.permissions') },
  { key: 'status', label: t('team.columns.status') },
  { key: 'action', label: '' },
]);

const summary = (row: TeamRow) =>
  granted(row.permissions).length === 0
    ? t('team.permissions.none')
    : granted(row.permissions)
        .map((item) => t(`permissions.${item}`))
        .join(', ');

// Every change refreshes both lists: an accepted invitation turns into a member.
const refresh = () => queryClient.invalidateQueries({ queryKey: ['team'] });

// ---- Inviting
const inviting = ref(false);
const email = ref('');
const emailError = ref<string | null>(null);
const choice = ref<Record<Permission, boolean>>({ ...DEFAULT_CHOICE });
const inviteBusy = ref(false);
const inviteFailure = ref<string | null>(null);

function openInvite() {
  email.value = '';
  emailError.value = null;
  inviteFailure.value = null;
  choice.value = { ...DEFAULT_CHOICE };
  inviting.value = true;
}

async function sendInvite() {
  const parsed = inviteSchema.safeParse({ email: email.value });
  if (!parsed.success) {
    emailError.value = t(parsed.error.issues[0]?.message ?? 'team.invite.errors.emailInvalid');
    return;
  }
  emailError.value = null;
  inviteBusy.value = true;
  inviteFailure.value = null;
  try {
    await api.invite(parsed.data.email, toChoice(choice.value));
    inviting.value = false;
    await refresh();
    toast.success(t('team.invite.sent', { email: parsed.data.email }));
  } catch (error) {
    inviteFailure.value = errorMessage(error);
  } finally {
    inviteBusy.value = false;
  }
}

// ---- Editing the permissions of an employee
const editing = ref<TeamRow | null>(null);
const editChoice = ref<Record<Permission, boolean>>({ ...DEFAULT_CHOICE });
const editBusy = ref(false);
const editFailure = ref<string | null>(null);

function openEdit(row: TeamRow) {
  editing.value = row;
  editChoice.value = { ...row.permissions };
  editFailure.value = null;
}

async function savePermissions() {
  if (!editing.value) return;
  editBusy.value = true;
  editFailure.value = null;
  try {
    await api.updatePermissions(editing.value.id, toChoice(editChoice.value));
    editing.value = null;
    await refresh();
    toast.success(t('team.edit.saved'));
  } catch (error) {
    editFailure.value = errorMessage(error);
  } finally {
    editBusy.value = false;
  }
}

// ---- Sending an invitation again
const busyKey = ref<string | null>(null);

async function resend(row: TeamRow) {
  busyKey.value = row.key;
  try {
    await api.resend(row.id);
    await refresh();
    toast.success(t('team.resent', { email: row.email }));
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    busyKey.value = null;
  }
}

// ---- Taking someone out (a member, or an invitation): it asks first
const confirming = ref<TeamRow | null>(null);
const confirmBusy = ref(false);
const confirmFailure = ref<string | null>(null);

function askRemove(row: TeamRow) {
  confirming.value = row;
  confirmFailure.value = null;
}

async function confirmRemove() {
  const row = confirming.value;
  if (!row) return;
  confirmBusy.value = true;
  confirmFailure.value = null;
  try {
    if (row.kind === 'member') await api.remove(row.id);
    else await api.revoke(row.id);
    confirming.value = null;
    await refresh();
    toast.success(t(row.kind === 'member' ? 'team.remove.done' : 'team.revoke.done'));
  } catch (error) {
    confirmFailure.value = errorMessage(error);
  } finally {
    confirmBusy.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <div class="row">
        <AppButton variant="primary" @click="openInvite">
          <AppIcon name="plus" />
          {{ t('team.invite.open') }}
        </AppButton>
      </div>
    </div>

    <AppCard as="section" :aria-label="t('team.caption')">
      <AppDataState
        :loading="members.isPending.value"
        :error="members.isError.value"
        :empty="rows.length === 0"
        :labels="{
          loading: t('team.loading'),
          emptyTitle: t('team.empty.title'),
          emptyText: t('team.empty.text'),
          errorTitle: t('team.error'),
          retry: t('team.retry'),
        }"
        @retry="members.refetch()"
      >
        <AppTable
          :caption="t('team.caption')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: TeamRow) => row.key"
        >
          <template #cell-member="{ row }">
            <span>{{ row.email }}</span>
            <span v-if="row.name" class="faint team__name">{{ row.name }}</span>
          </template>
          <template #cell-role="{ row }">
            <AppBadge v-if="row.owner" tone="primary">{{ t('team.role.OWNER') }}</AppBadge>
            <AppBadge v-else>{{ t('team.role.STAFF') }}</AppBadge>
          </template>
          <template #cell-permissions="{ row }">
            <span v-if="row.owner" class="muted">{{ t('team.permissions.all') }}</span>
            <span v-else>{{ summary(row) }}</span>
          </template>
          <template #cell-status="{ row }">
            <AppBadge v-if="row.status === 'pending'" tone="warning">
              {{ t('team.status.pending') }}
            </AppBadge>
            <AppBadge v-else-if="row.status === 'expired'" tone="danger">
              {{ t('team.status.expired') }}
            </AppBadge>
            <span v-else>{{ t('team.status.active') }}</span>
          </template>
          <template #cell-action="{ row }">
            <div v-if="!row.owner" class="row">
              <AppButton
                v-if="row.kind === 'member'"
                size="sm"
                :label="t('team.edit.aria', { email: row.email })"
                @click="openEdit(row)"
              >
                {{ t('team.edit.open') }}
              </AppButton>
              <AppButton
                v-else
                size="sm"
                :busy="busyKey === row.key"
                :label="t('team.resend.aria', { email: row.email })"
                @click="resend(row)"
              >
                {{ t('team.resend.open') }}
              </AppButton>
              <AppButton
                size="sm"
                variant="ghost"
                :label="
                  t(row.kind === 'member' ? 'team.remove.aria' : 'team.revoke.aria', {
                    email: row.email,
                  })
                "
                @click="askRemove(row)"
              >
                {{ t(row.kind === 'member' ? 'team.remove.open' : 'team.revoke.open') }}
              </AppButton>
            </div>
          </template>
        </AppTable>
      </AppDataState>
    </AppCard>

    <p v-if="invitations.isError.value" role="alert" class="hint hint--error">
      {{ t('team.invitationsError') }}
    </p>

    <!-- Inviting -->
    <AppModal
      :open="inviting"
      :title="t('team.invite.title')"
      :close-label="t('team.close')"
      @close="inviting = false"
    >
      <div class="stack">
        <AppInput
          v-model="email"
          :label="t('team.invite.email')"
          :error="emailError"
          type="email"
          name="email"
          autocomplete="off"
          :placeholder="t('team.invite.emailPlaceholder')"
        />
        <span class="label">{{ t('team.permissions.title') }}</span>
        <PermissionMatrix
          v-model="choice"
          :labels="labels"
          :blocked-note="t('team.permissions.blocked')"
          :disabled="inviteBusy"
        />
        <p class="muted">{{ t('team.invite.hint') }}</p>
        <p v-if="inviteFailure" role="alert" class="hint hint--error">{{ inviteFailure }}</p>
      </div>
      <template #foot>
        <AppButton @click="inviting = false">{{ t('team.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="inviteBusy" @click="sendInvite">
          {{ t('team.invite.send') }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Editing -->
    <AppModal
      :open="editing !== null"
      :title="t('team.edit.title')"
      :close-label="t('team.close')"
      @close="editing = null"
    >
      <div class="stack">
        <p class="muted">{{ editing?.email }}</p>
        <PermissionMatrix
          v-model="editChoice"
          :labels="labels"
          :blocked-note="t('team.permissions.blocked')"
          :disabled="editBusy"
        />
        <p v-if="editFailure" role="alert" class="hint hint--error">{{ editFailure }}</p>
      </div>
      <template #foot>
        <AppButton @click="editing = null">{{ t('team.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="editBusy" @click="savePermissions">
          {{ t('team.edit.save') }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Taking out -->
    <AppModal
      :open="confirming !== null"
      :title="t(confirming?.kind === 'invite' ? 'team.revoke.title' : 'team.remove.title')"
      :close-label="t('team.close')"
      @close="confirming = null"
    >
      <div class="stack">
        <p>
          {{
            t(confirming?.kind === 'invite' ? 'team.revoke.text' : 'team.remove.text', {
              email: confirming?.email ?? '',
            })
          }}
        </p>
        <p v-if="confirmFailure" role="alert" class="hint hint--error">{{ confirmFailure }}</p>
      </div>
      <template #foot>
        <AppButton @click="confirming = null">{{ t('team.cancel') }}</AppButton>
        <AppButton variant="danger" :busy="confirmBusy" @click="confirmRemove">
          {{ t(confirming?.kind === 'invite' ? 'team.revoke.confirm' : 'team.remove.confirm') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
