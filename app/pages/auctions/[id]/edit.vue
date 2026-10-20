<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useForm } from 'vee-validate';
import { createAuctionsApi } from '../../../api/auctions';
import {
  canCancel,
  editMode,
  termsOf,
  termsSchema,
  toUpdateBody,
  type TermsContext,
} from '../../../utils/auctions';
import { cardTitle } from '../../../utils/inventory';
import { toFormSchema } from '../../../utils/zod-schema';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'auctionEdit.title',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

const { t } = useI18n();
const route = useRoute();
const access = useAccessStore();
const preferences = usePreferencesStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createAuctionsApi(useApi());

const id = computed(() => String(route.params.id));
const detail = useQuery({
  queryKey: computed(() => ['auction', access.storeId, id.value]),
  queryFn: ({ signal }) => api.get(id.value, signal),
});
const auction = computed(() => detail.data.value?.auction);

const mode = computed(() => (auction.value ? editMode(auction.value.status) : 'none'));
const now = ref(Date.now());
const context = computed<TermsContext>(() => ({
  timeZone: preferences.timezone,
  now: now.value,
  needsStart: true,
  endOnly: mode.value === 'end',
}));

const form = useForm({
  validationSchema: computed(() => toFormSchema(termsSchema(context.value))),
  initialValues: { type: 'FREE_BID', start: '', end: '', initial: '', increment: '', ceiling: '' },
});
const [type] = form.defineField('type');
const [start] = form.defineField('start');
const [end] = form.defineField('end');
const [initial] = form.defineField('initial');
const [increment] = form.defineField('increment');
const [ceiling] = form.defineField('ceiling');

// The form starts with what the auction has, in the zone of the profile.
watch(
  auction,
  (current) => {
    if (current) form.resetForm({ values: termsOf(current, preferences.timezone) });
  },
  { immediate: true },
);

const errors = computed(() => {
  const keys = ['type', 'start', 'end', 'initial', 'increment', 'ceiling'] as const;
  return Object.fromEntries(
    keys.map((key) => [key, form.errors.value[key] ? t(form.errors.value[key]) : null]),
  );
});

const title = computed(() => (auction.value ? cardTitle(auction.value.card.catalog) : ''));

const busy = ref(false);
const submitError = ref<string | null>(null);

async function refresh() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['auctions'] }),
    queryClient.invalidateQueries({ queryKey: ['auction'] }),
    queryClient.invalidateQueries({ queryKey: ['home'] }),
  ]);
}

const submit = form.handleSubmit(async (values) => {
  const current = auction.value;
  if (!current) return;
  const changes = toUpdateBody(current, values, context.value);
  if (Object.keys(changes).length === 0) {
    toast.info(t('auctionEdit.nothingChanged'));
    return;
  }
  busy.value = true;
  submitError.value = null;
  try {
    await api.update(current.id, changes);
    await refresh();
    toast.success(t('auctionEdit.saved'));
    await navigateTo('/auctions');
  } catch (error) {
    submitError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
});

function onSubmit() {
  now.value = Date.now();
  return submit();
}

// ---- Cancelling
const confirming = ref(false);
const cancelling = ref(false);
const cancelError = ref<string | null>(null);

async function cancelAuction() {
  const current = auction.value;
  if (!current) return;
  cancelling.value = true;
  cancelError.value = null;
  try {
    await api.cancel(current.id);
    confirming.value = false;
    await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['inventory'] })]);
    toast.success(t('auctionEdit.cancelled'));
    await navigateTo('/auctions');
  } catch (error) {
    cancelError.value = errorMessage(error);
  } finally {
    cancelling.value = false;
  }
}

const statusTone = computed(() => {
  switch (auction.value?.status) {
    case 'ACTIVE':
      return 'success';
    case 'PAUSED_FOR_VALIDATION':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    case 'PENDING':
      return 'info';
    default:
      return undefined;
  }
});
</script>

<template>
  <div class="stack">
    <AppState v-if="detail.isPending.value" kind="loading" :title="t('auctionEdit.loading')" />
    <AppState
      v-else-if="!auction"
      kind="error"
      :title="t('auctionEdit.error.title')"
      :text="errorMessage(detail.error.value)"
      :action-label="t('auctionEdit.error.retry')"
      @action="detail.refetch()"
    />

    <template v-else>
      <div class="crumb">
        <NuxtLink to="/auctions">{{ t('auctions.title') }}</NuxtLink> /
        <span class="id-chip">#{{ auction.card.short_code }}</span> {{ title }}
      </div>

      <div class="page-head">
        <h2>{{ t('auctionEdit.title') }}</h2>
        <div class="row">
          <AppBadge :tone="statusTone" :live="auction.status === 'ACTIVE'">
            {{ t(`auctions.status.${auction.status}`) }}
          </AppBadge>
        </div>
      </div>

      <form class="stack" novalidate @submit.prevent="onSubmit">
        <AppCard as="section" :aria-label="t('auctionEdit.title')" body-class="stack">
          <b class="auctions__title">{{ title }}</b>
          <span class="muted">
            {{ auction.card.catalog.set_name }} · {{ auction.card.condition }} ·
            {{ auction.card.language.toUpperCase() }}
          </span>

          <p v-if="mode === 'end'" class="muted">{{ t('auctionEdit.endOnly') }}</p>
          <p v-else-if="mode === 'none'" class="muted">{{ t('auctionEdit.locked') }}</p>

          <AuctionTerms
            v-model:type="type"
            v-model:start="start"
            v-model:end="end"
            v-model:initial="initial"
            v-model:increment="increment"
            v-model:ceiling="ceiling"
            :needs-start="true"
            :end-only="mode === 'end'"
            :errors="errors"
            :disabled="busy || mode === 'none'"
          />
        </AppCard>

        <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
        <div class="row auctions__actions">
          <AppButton
            v-if="canCancel(auction.status)"
            variant="danger"
            @click="
              cancelError = null;
              confirming = true;
            "
          >
            {{ t('auctionEdit.cancel') }}
          </AppButton>
          <span v-else class="grow" />
          <div class="row">
            <AppButton to="/auctions">{{ t('auctionEdit.back') }}</AppButton>
            <AppButton v-if="mode !== 'none'" type="submit" variant="primary" :busy="busy">
              {{ t('auctionEdit.save') }}
            </AppButton>
          </div>
        </div>
      </form>

      <AppModal
        :open="confirming"
        :title="t('auctionEdit.confirm.title')"
        :close-label="t('auctionEdit.confirm.close')"
        @close="confirming = false"
      >
        <p>{{ t('auctionEdit.confirm.text', { title }) }}</p>
        <p v-if="cancelError" role="alert" class="hint hint--error">{{ cancelError }}</p>
        <template #foot>
          <AppButton @click="confirming = false">{{ t('auctionEdit.confirm.keep') }}</AppButton>
          <AppButton variant="danger" :busy="cancelling" @click="cancelAuction">
            {{ t('auctionEdit.confirm.cancel') }}
          </AppButton>
        </template>
      </AppModal>
    </template>
  </div>
</template>
