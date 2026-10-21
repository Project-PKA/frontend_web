<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createPlanApi, type PlanRequest } from '../api/plan';
import type { TableColumn } from '../components/AppTable.vue';
import { MESSAGE_MAX, atLimit, toPlanChange, usageRows } from '../utils/plan';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'plan.title',
  access: { level: 'store', owner: true },
});

const TONES = { PENDING: 'warning', APPLIED: 'success', REFUSED: 'danger' } as const;

const { t, te } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createPlanApi(useApi());

const plan = useQuery({
  queryKey: computed(() => ['plan', access.storeId]),
  queryFn: ({ signal }) => api.overview(signal),
});
const data = computed(() => plan.data.value);

/** The name of a plan: translated when the app knows the code, as the API sent it otherwise. */
function planName(code: string | null | undefined): string {
  if (!code) return '';
  return te(`plan.names.${code}`) ? t(`plan.names.${code}`) : code;
}

const usage = computed(() => (data.value ? usageRows(data.value) : []));

// ---- Asking for a change
const asking = ref(false);
const requestedPlan = ref('');
const message = ref('');
const errors = reactive<{ form: string | null; plan: string | null; message: string | null }>({
  form: null,
  plan: null,
  message: null,
});
const busy = ref(false);

function openAsk() {
  requestedPlan.value = '';
  message.value = '';
  errors.form = errors.plan = errors.message = null;
  asking.value = true;
}

async function sendRequest() {
  errors.form = errors.plan = errors.message = null;
  const result = toPlanChange(requestedPlan.value, message.value);
  if ('error' in result) {
    if (result.error === 'empty') errors.form = t('plan.ask.errors.empty');
    else if (result.error === 'planInvalid') errors.plan = t('plan.ask.errors.planInvalid');
    else errors.message = t('validation.tooLong');
    return;
  }
  busy.value = true;
  try {
    await api.requestChange(result.change);
    asking.value = false;
    await queryClient.invalidateQueries({ queryKey: ['plan'] });
    toast.success(t('plan.ask.sent'));
  } catch (error) {
    errors.form = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

// ---- The requests already made
const columns = computed<TableColumn[]>(() => [
  { key: 'created', label: t('plan.requests.columns.created') },
  { key: 'plan', label: t('plan.requests.columns.plan') },
  { key: 'message', label: t('plan.requests.columns.message') },
  { key: 'status', label: t('plan.requests.columns.status') },
]);
const rows = computed(() =>
  (data.value?.recent_requests ?? []).map((item) => ({
    id: item.id,
    created: format.dateTime(item.created_at),
    plan: planName(item.requested_plan) || '—',
    message: item.message ?? '',
    status: item.status,
    decided: item.decided_at ? format.dateTime(item.decided_at) : null,
  })),
);
type Row = (typeof rows.value)[number];

const pending = computed<PlanRequest | null>(() => data.value?.pending_request ?? null);
</script>

<template>
  <div class="stack">
    <div class="crumb">
      <NuxtLink to="/settings">{{ t('nav.settings') }}</NuxtLink> / {{ t('plan.title') }}
    </div>

    <AppState v-if="plan.isPending.value" kind="loading" :title="t('plan.loading')" />
    <AppState
      v-else-if="plan.isError.value || !data"
      kind="error"
      :title="t('plan.error.title')"
      :text="t('plan.error.text')"
      :action-label="t('plan.error.retry')"
      @action="plan.refetch()"
    />

    <template v-else>
      <AppCard as="section" highlight :aria-label="t('plan.current')">
        <div class="card__head">
          <h2 class="card__title">{{ t('plan.current') }}</h2>
          <AppBadge tone="success">{{ t('plan.active') }}</AppBadge>
        </div>
        <div class="card__body stack">
          <div>
            <b class="plan__name">{{ planName(data.plan) }}</b>
          </div>
          <p class="muted">{{ t('plan.text') }}</p>

          <div v-for="row in usage" :key="row.key" class="stack plan__usage">
            <div class="row plan__row">
              <span class="muted">{{ t(`plan.usage.${row.key}`) }}</span>
              <span class="mono">
                {{
                  row.limit === null
                    ? t('plan.usage.noLimit', { used: row.used })
                    : t('plan.usage.of', { used: row.used, limit: row.limit })
                }}
              </span>
            </div>
            <AppProgress
              v-if="row.limit !== null"
              :value="row.used"
              :max="row.limit"
              :label="t(`plan.usage.${row.key}`)"
              :value-text="t('plan.usage.of', { used: row.used, limit: row.limit })"
            />
            <p v-if="atLimit(row)" class="hint hint--error">{{ t('plan.usage.atLimit') }}</p>
            <p
              v-if="row.key === 'members' && data.usage.pending_invitations > 0"
              class="faint plan__note"
            >
              {{
                t(
                  'plan.usage.pendingInvitations',
                  { count: data.usage.pending_invitations },
                  data.usage.pending_invitations,
                )
              }}
            </p>
          </div>

          <div v-if="pending" class="alert" role="status">
            <div class="alert__body">
              <b>{{ t('plan.pending.title') }}</b>
              <span v-if="pending.requested_plan">
                {{ t('plan.pending.plan', { plan: planName(pending.requested_plan) }) }}
              </span>
              <span v-if="pending.message" class="plan__message">{{ pending.message }}</span>
              <span class="faint">{{ format.dateTime(pending.created_at) }}</span>
            </div>
          </div>

          <div>
            <AppButton @click="openAsk">
              {{ pending ? t('plan.ask.again') : t('plan.ask.open') }}
            </AppButton>
          </div>
        </div>
      </AppCard>

      <AppCard v-if="rows.length > 0" as="section" :aria-label="t('plan.requests.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('plan.requests.title') }}</h2>
        </div>
        <AppTable
          :caption="t('plan.requests.title')"
          :columns="columns"
          :rows="rows"
          :row-key="(row: Row) => row.id"
        >
          <template #cell-status="{ row }">
            <AppBadge :tone="TONES[row.status as keyof typeof TONES]">
              {{ t(`plan.requests.status.${row.status}`) }}
            </AppBadge>
            <span v-if="row.decided" class="faint plan__note">{{ row.decided }}</span>
          </template>
        </AppTable>
      </AppCard>

      <p class="faint">{{ t('plan.billing') }}</p>
    </template>

    <AppModal
      :open="asking"
      :title="t('plan.ask.title')"
      :close-label="t('plan.close')"
      @close="asking = false"
    >
      <div class="stack">
        <p class="muted">{{ t('plan.ask.intro') }}</p>
        <AppInput
          v-model="requestedPlan"
          :label="t('plan.ask.plan')"
          :hint="t('plan.ask.planHint')"
          :error="errors.plan"
          name="plan"
          autocomplete="off"
          maxlength="20"
        />
        <AppTextarea
          v-model="message"
          :label="t('plan.ask.message')"
          :error="errors.message"
          name="message"
          rows="4"
          :maxlength="MESSAGE_MAX + 50"
        />
        <p v-if="errors.form" role="alert" class="hint hint--error">{{ errors.form }}</p>
      </div>
      <template #foot>
        <AppButton @click="asking = false">{{ t('plan.cancel') }}</AppButton>
        <AppButton variant="primary" :busy="busy" @click="sendRequest">
          {{ t('plan.ask.send') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
