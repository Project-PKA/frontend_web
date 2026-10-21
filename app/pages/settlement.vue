<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createPublicPagesApi } from '../api/public-pages';
import { ApiError } from '../api/errors';
import { maskCep, maskCpf } from '../utils/documents';
import { tokenFromFragment } from '../utils/fragment-token';
import {
  RECEIPT_TYPES,
  checkReceipt,
  normalizeSettlement,
  toBuyerSubmission,
  type BuyerFormError,
} from '../utils/public-pages';

definePageMeta({ i18n: false, layout: 'plain' });

const TONES = { PENDING: 'warning', PAID: 'success' } as const;

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const errorMessage = useErrorMessage();
const format = useFormat();
const queryClient = useQueryClient();
const api = createPublicPagesApi(usePublicApi());

// The token is in the fragment (never in the path or the query), so it does not reach a log.
useHead({
  title: () => t('settlementPage.title'),
  meta: [
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'no-referrer' },
  ],
});

const token = computed(() => tokenFromFragment(route.hash));

const settlement = useQuery({
  queryKey: ['public-settlement', token],
  queryFn: async () => normalizeSettlement(await api.settlement(token.value as string)),
  enabled: computed(() => token.value !== null),
  retry: false,
  staleTime: Infinity,
});

/** A missing token and an invalid, expired, revoked or blocked link look the same: so does the API. */
const unavailable = computed(
  () =>
    token.value === null ||
    (settlement.error.value instanceof ApiError && settlement.error.value.status === 404),
);
const failed = computed(() => settlement.isError.value && !unavailable.value);
const loading = computed(() => token.value !== null && settlement.isPending.value);
const view = computed(() => settlement.data.value ?? null);

async function copy(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.info(message);
  } catch {
    toast.error(t('settlementPage.copyFailed'));
  }
}

// ---- Your data: CPF and address, with the consent
const cpf = ref('');
const zip = ref('');
const street = ref('');
const number = ref('');
const comp = ref('');
const city = ref('');
const state = ref('');
const consent = ref(false);
const errors = reactive<Partial<Record<BuyerFormError, string>>>({});
const failure = ref<string | null>(null);
const saving = ref(false);

const FIELD_ERRORS: Record<BuyerFormError, string> = {
  cpf: 'settlementPage.errors.cpf',
  zip: 'settlementPage.errors.zip',
  street: 'settlementPage.errors.required',
  number: 'settlementPage.errors.required',
  comp: 'validation.tooLong',
  city: 'settlementPage.errors.required',
  state: 'settlementPage.errors.state',
  consent: 'settlementPage.errors.consent',
};

async function save() {
  for (const key of Object.keys(FIELD_ERRORS) as BuyerFormError[]) errors[key] = undefined;
  failure.value = null;
  const result = toBuyerSubmission({
    cpf: cpf.value,
    zip: zip.value,
    street: street.value,
    number: number.value,
    comp: comp.value,
    city: city.value,
    state: state.value,
    consent: consent.value,
  });
  if ('errors' in result) {
    for (const key of Object.keys(result.errors) as BuyerFormError[]) {
      errors[key] = t(FIELD_ERRORS[key]);
    }
    return;
  }
  saving.value = true;
  try {
    await api.submitBuyerData(token.value as string, result.data);
    await queryClient.invalidateQueries({ queryKey: ['public-settlement'] });
    cpf.value = '';
    consent.value = false;
    toast.success(t('settlementPage.data.saved'));
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

// ---- "I already paid": it only warns the store, the store is the one that confirms
const claiming = ref(false);
const claimFailure = ref<string | null>(null);

async function claim() {
  claiming.value = true;
  claimFailure.value = null;
  try {
    const answer = await api.claimPaid(token.value as string);
    await queryClient.invalidateQueries({ queryKey: ['public-settlement'] });
    toast.success(
      t(
        answer.result === 'ALREADY_PAID' ? 'settlementPage.pay.already' : 'settlementPage.pay.sent',
      ),
    );
  } catch (error) {
    claimFailure.value = errorMessage(error);
  } finally {
    claiming.value = false;
  }
}

// ---- The receipt of the payment: an image, optional
const receiptInput = ref<HTMLInputElement | null>(null);
const sending = ref(false);
const receiptFailure = ref<string | null>(null);

async function sendReceipt() {
  const file = receiptInput.value?.files?.[0];
  receiptFailure.value = null;
  if (!file) {
    receiptFailure.value = t('settlementPage.receipt.errors.choose');
    return;
  }
  const problem = checkReceipt(file);
  if (problem) {
    receiptFailure.value = t(`settlementPage.receipt.errors.${problem}`);
    return;
  }
  sending.value = true;
  try {
    const answer = await api.sendReceipt(token.value as string, file);
    await queryClient.invalidateQueries({ queryKey: ['public-settlement'] });
    if (receiptInput.value) receiptInput.value.value = '';
    toast.success(
      t(answer.result === 'OK' ? 'settlementPage.receipt.sent' : 'settlementPage.receipt.already'),
    );
  } catch (error) {
    receiptFailure.value = errorMessage(error);
  } finally {
    sending.value = false;
  }
}

const savedAddress = computed(() => {
  const buyer = view.value?.buyer;
  if (!buyer?.hasAddress) return null;
  return [buyer.city, buyer.state].filter(Boolean).join(' / ');
});
</script>

<template>
  <main id="main" class="wrap settlement">
    <AppState v-if="loading" kind="loading" :title="t('settlementPage.loading')" />

    <div v-else-if="unavailable" class="center-page">
      <AppCard class="narrow" body-class="stack">
        <h1>{{ t('settlementPage.invalid.title') }}</h1>
        <p class="muted">{{ t('settlementPage.invalid.text') }}</p>
      </AppCard>
    </div>

    <AppState
      v-else-if="failed"
      kind="error"
      :title="t('settlementPage.failed.title')"
      :text="t('settlementPage.failed.text')"
      :action-label="t('settlementPage.failed.retry')"
      @action="settlement.refetch()"
    />

    <div v-else-if="view" class="narrow-lg stack settlement__page">
      <div class="stack settlement__head">
        <div class="row">
          <h1>
            {{
              view.buyer.firstName
                ? t('settlementPage.heading', { name: view.buyer.firstName })
                : t('settlementPage.headingNoName')
            }}
          </h1>
          <AppBadge :tone="TONES[view.status]">{{
            t(`settlementPage.status.${view.status}`)
          }}</AppBadge>
        </div>
        <p class="muted">
          {{
            t(
              'settlementPage.intro',
              { count: view.items.length, store: view.storeName },
              view.items.length,
            )
          }}
        </p>
      </div>

      <AppCard as="section" :aria-label="t('settlementPage.items.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settlementPage.items.title') }}</h2>
        </div>
        <div class="table-wrap">
          <table class="table">
            <caption class="visually-hidden">
              {{
                t('settlementPage.items.title')
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ t('settlementPage.items.id') }}</th>
                <th scope="col">{{ t('settlementPage.items.card') }}</th>
                <th scope="col" class="num">{{ t('settlementPage.items.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in view.items" :key="item.code">
                <td>
                  <AppIdChip
                    :code="item.code"
                    :label="t('settlementPage.items.copy', { code: item.code })"
                    @copy="
                      copy(`#${$event}`, t('settlementPage.items.copied', { code: item.code }))
                    "
                  />
                </td>
                <td>
                  {{ item.name }}
                  <span class="faint settlement__meta">{{
                    [item.condition, item.language].filter(Boolean).join(' · ')
                  }}</span>
                </td>
                <td class="num">{{ format.money(item.amount) }}</td>
              </tr>
              <tr>
                <td />
                <td>
                  <b>{{ t('settlementPage.items.total') }}</b>
                </td>
                <td class="num">
                  <b>{{ format.money(view.total) }}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard as="section" :aria-label="t('settlementPage.data.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settlementPage.data.title') }}</h2>
          <span class="faint settlement__meta">{{ t('settlementPage.data.use') }}</span>
        </div>
        <form class="card__body stack" novalidate @submit.prevent="save">
          <p v-if="view.buyer.cpfMasked || savedAddress" class="hint" role="status">
            {{
              t('settlementPage.data.savedLine', {
                cpf: view.buyer.cpfMasked ?? '—',
                place: savedAddress ?? '—',
              })
            }}
          </p>
          <div class="form-grid">
            <AppInput
              :model-value="cpf"
              :label="t('settlementPage.data.cpf')"
              :error="errors.cpf"
              name="cpf"
              inputmode="numeric"
              autocomplete="off"
              placeholder="000.000.000-00"
              maxlength="14"
              @update:model-value="(value: string) => (cpf = maskCpf(value))"
            />
            <AppInput
              :model-value="zip"
              :label="t('settlementPage.data.zip')"
              :error="errors.zip"
              name="zip"
              inputmode="numeric"
              autocomplete="postal-code"
              placeholder="00000-000"
              maxlength="9"
              @update:model-value="(value: string) => (zip = maskCep(value))"
            />
            <AppInput
              v-model="street"
              :label="t('settlementPage.data.street')"
              :error="errors.street"
              name="street"
              autocomplete="address-line1"
              maxlength="120"
            />
            <AppInput
              v-model="number"
              :label="t('settlementPage.data.number')"
              :error="errors.number"
              name="number"
              autocomplete="off"
              maxlength="20"
            />
            <AppInput
              v-model="comp"
              :label="t('settlementPage.data.comp')"
              :error="errors.comp"
              name="comp"
              autocomplete="address-line2"
              maxlength="60"
            />
            <AppInput
              v-model="city"
              :label="t('settlementPage.data.city')"
              :error="errors.city"
              name="city"
              autocomplete="address-level2"
              maxlength="80"
            />
            <AppInput
              v-model="state"
              :label="t('settlementPage.data.state')"
              :error="errors.state"
              name="state"
              autocomplete="address-level1"
              maxlength="2"
            />
          </div>

          <div class="stack settlement__consent">
            <AppSwitch v-model="consent" :disabled="saving">
              {{ t('settlementPage.data.consent') }}
            </AppSwitch>
            <p v-if="errors.consent" class="hint hint--error">{{ errors.consent }}</p>
            <p class="faint settlement__meta">
              {{ t('settlementPage.data.consentNote') }}
              <NuxtLink to="/privacy">{{ t('settlementPage.data.privacy') }}</NuxtLink>
            </p>
          </div>

          <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
          <div class="row settlement__actions">
            <AppButton type="submit" variant="primary" :busy="saving">
              {{ t('settlementPage.data.save') }}
            </AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard as="section" :aria-label="t('settlementPage.pay.title')">
        <div class="card__head">
          <h2 class="card__title">{{ t('settlementPage.pay.title') }}</h2>
        </div>
        <div class="card__body stack">
          <p class="muted">{{ t('settlementPage.pay.text') }}</p>
          <div v-if="view.pixKey" class="row">
            <span class="mono grow settlement__pix">{{
              t('settlementPage.pay.pix', { key: view.pixKey })
            }}</span>
            <AppButton @click="copy(view.pixKey ?? '', t('settlementPage.pay.copied'))">
              <AppIcon name="copy" />
              {{ t('settlementPage.pay.copy') }}
            </AppButton>
          </div>
          <p v-else class="hint">{{ t('settlementPage.pay.noPix') }}</p>

          <div v-if="view.status === 'PENDING'" class="field settlement__receipt">
            <span class="label">{{ t('settlementPage.receipt.label') }}</span>
            <p v-if="view.receiptSent" class="hint" role="status">
              {{ t('settlementPage.receipt.done') }}
            </p>
            <div v-else class="stack">
              <input
                ref="receiptInput"
                class="input"
                type="file"
                :accept="RECEIPT_TYPES.join(',')"
                :aria-label="t('settlementPage.receipt.label')"
              />
              <p class="faint settlement__meta">{{ t('settlementPage.receipt.hint') }}</p>
              <p v-if="receiptFailure" role="alert" class="hint hint--error">
                {{ receiptFailure }}
              </p>
              <div class="row">
                <AppButton :busy="sending" @click="sendReceipt">
                  <AppIcon name="download" />
                  {{ t('settlementPage.receipt.send') }}
                </AppButton>
              </div>
            </div>
          </div>

          <p v-if="view.claimedAt" class="hint" role="status">
            {{ t('settlementPage.pay.claimedAt', { when: format.dateTime(view.claimedAt) }) }}
          </p>
          <p v-if="view.status === 'PAID'" class="hint" role="status">
            {{ t('settlementPage.pay.confirmed') }}
          </p>
          <p v-if="claimFailure" role="alert" class="hint hint--error">{{ claimFailure }}</p>
          <AppButton
            v-if="view.status === 'PENDING'"
            variant="primary"
            size="lg"
            block
            :busy="claiming"
            @click="claim"
          >
            {{ view.claimedAt ? t('settlementPage.pay.again') : t('settlementPage.pay.claim') }}
          </AppButton>
          <p class="faint settlement__meta">{{ t('settlementPage.pay.note') }}</p>
        </div>
      </AppCard>
    </div>
  </main>
</template>
