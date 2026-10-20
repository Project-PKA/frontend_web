<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { useForm } from 'vee-validate';
import { createAuctionsApi, type Auction } from '../api/auctions';
import type { CardItem } from '../api/inventory';
import { termsSchema, toCreateBody, type TermsContext } from '../utils/auctions';
import { cardTitle } from '../utils/inventory';
import { toFormSchema } from '../utils/zod-schema';

/**
 * The form of a new auction, in a modal: one card (an available one), when it starts (a date, or
 * now) and the terms. The API takes one card per auction.
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; created: [auction: Auction] }>();

const { t } = useI18n();
const preferences = usePreferencesStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createAuctionsApi(useApi());

// The card, from the store's available stock
const cardText = ref('');
const card = ref<CardItem | null>(null);
const cardError = ref<string | null>(null);
const cardSearch = useAvailableCardSearch(cardText);

const cardLabels = computed(() => ({
  label: t('auctions.create.card.label'),
  hint: t('auctions.create.card.hint'),
  loading: t('auctions.create.card.loading'),
  none: t('auctions.create.card.none', { text: cardText.value.trim() }),
  error: t('auctions.create.card.error'),
  retry: t('auctions.create.card.retry'),
  count: t(
    'auctions.create.card.count',
    { count: cardSearch.results.value.length },
    cardSearch.results.value.length,
  ),
}));

// When it starts, and the terms
const mode = ref<'SCHEDULE' | 'NOW'>('SCHEDULE');
const now = ref(Date.now());
const context = computed<TermsContext>(() => ({
  timeZone: preferences.timezone,
  now: now.value,
  needsStart: mode.value === 'SCHEDULE',
}));

const INITIAL_VALUES = {
  type: 'FREE_BID',
  start: '',
  end: '',
  initial: '20',
  increment: '5',
  ceiling: '500',
};
const form = useForm({
  validationSchema: computed(() => toFormSchema(termsSchema(context.value))),
  initialValues: { ...INITIAL_VALUES },
});
const [type] = form.defineField('type');
const [start] = form.defineField('start');
const [end] = form.defineField('end');
const [initial] = form.defineField('initial');
const [increment] = form.defineField('increment');
const [ceiling] = form.defineField('ceiling');

const errors = computed(() => {
  const keys = ['type', 'start', 'end', 'initial', 'increment', 'ceiling'] as const;
  return Object.fromEntries(
    keys.map((key) => [key, form.errors.value[key] ? t(form.errors.value[key]) : null]),
  );
});

// Every time it opens it starts empty
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.resetForm({ values: { ...INITIAL_VALUES } });
    cardText.value = '';
    card.value = null;
    cardError.value = null;
    submitError.value = null;
    mode.value = 'SCHEDULE';
  },
);

function chooseCard(item: CardItem) {
  card.value = item;
  cardError.value = null;
}

const busy = ref(false);
const submitError = ref<string | null>(null);

const submit = form.handleSubmit(async (values) => {
  if (!card.value) {
    cardError.value = t('validation.required');
    return;
  }
  busy.value = true;
  submitError.value = null;
  try {
    const created = await api.create(toCreateBody(card.value.id, values, context.value));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['auctions'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['home'] }),
    ]);
    toast.success(
      t(mode.value === 'NOW' ? 'auctions.create.launched' : 'auctions.create.scheduled', {
        title: cardTitle(card.value.catalog),
      }),
    );
    emit('created', created);
    emit('close');
  } catch (error) {
    submitError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
});

/** The check of "the end must be in the future" uses the moment the person presses Save. */
function onSubmit() {
  now.value = Date.now();
  return submit();
}
</script>

<template>
  <AppModal
    :open="open"
    :title="t('auctions.create.title')"
    :close-label="t('auctions.create.close')"
    @close="emit('close')"
  >
    <form id="auction-create" class="stack" novalidate @submit.prevent="onSubmit">
      <div class="stack">
        <div v-if="card" class="row auctions__picked">
          <span class="grow">
            <span class="id-chip">#{{ card.short_code }}</span>
            <b> {{ cardTitle(card.catalog) }}</b>
            <span class="muted"> · {{ card.condition }}</span>
          </span>
          <AppButton size="sm" variant="ghost" @click="card = null">
            {{ t('auctions.create.card.change') }}
          </AppButton>
        </div>
        <CardSearch
          v-else
          v-model:query="cardText"
          :results="cardSearch.results.value"
          :loading="cardSearch.loading.value"
          :error="cardSearch.error.value"
          :labels="cardLabels"
          @select="chooseCard"
          @retry="cardSearch.retry()"
        />
        <p v-if="cardError" role="alert" class="hint hint--error">{{ cardError }}</p>
      </div>

      <div class="field">
        <span id="auction-when-label" class="label">{{ t('auctions.create.when.label') }}</span>
        <div class="seg" role="group" aria-labelledby="auction-when-label">
          <button
            type="button"
            :class="{ 'is-active': mode === 'SCHEDULE' }"
            :aria-pressed="mode === 'SCHEDULE'"
            @click="mode = 'SCHEDULE'"
          >
            {{ t('auctions.create.when.schedule') }}
          </button>
          <button
            type="button"
            :class="{ 'is-active': mode === 'NOW' }"
            :aria-pressed="mode === 'NOW'"
            @click="mode = 'NOW'"
          >
            {{ t('auctions.create.when.now') }}
          </button>
        </div>
        <p v-if="mode === 'NOW'" class="hint">{{ t('auctions.create.when.nowHint') }}</p>
      </div>

      <AuctionTerms
        v-model:type="type"
        v-model:start="start"
        v-model:end="end"
        v-model:initial="initial"
        v-model:increment="increment"
        v-model:ceiling="ceiling"
        :needs-start="mode === 'SCHEDULE'"
        :errors="errors"
        :disabled="busy"
      />

      <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
    </form>
    <template #foot>
      <AppButton @click="emit('close')">{{ t('auctions.create.cancel') }}</AppButton>
      <AppButton type="submit" form="auction-create" variant="primary" :busy="busy">
        {{ mode === 'NOW' ? t('auctions.create.launch') : t('auctions.create.schedule') }}
      </AppButton>
    </template>
  </AppModal>
</template>
