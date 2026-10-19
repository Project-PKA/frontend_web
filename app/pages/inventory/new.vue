<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { useForm } from 'vee-validate';
import type { CatalogCard } from '../../api/catalog';
import type { Customer } from '../../api/customers';
import { createCustomersApi } from '../../api/customers';
import { createInventoryApi } from '../../api/inventory';
import { artUrl } from '../../utils/catalog';
import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  cardFormSchema,
  consignorLinkUrl,
  toCreateBody,
  whatsappUrl,
  type PhotoProblem,
} from '../../utils/card-form';
import { cardTitle } from '../../utils/inventory';
import { toFormSchema } from '../../utils/zod-schema';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'inventory.new.title',
  access: { level: 'store', permission: 'can_manage_inventory' },
});

/** The share the design starts the commission at. */
const DEFAULT_COMMISSION = '15';

const { t, te } = useI18n();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const inventoryApi = createInventoryApi(useApi());
const customersApi = createCustomersApi(useApi());

// ---- Step 1: the card, from the catalog
const text = ref('');
const picked = ref<CatalogCard | null>(null);
const search = useCatalogSearch(text);

const searchLabels = computed(() => ({
  label: t('inventory.new.search.label'),
  hint: t('inventory.new.search.hint'),
  loading: t('inventory.new.search.loading'),
  none: t('inventory.new.search.none', { text: text.value.trim() }),
  error: t('inventory.new.search.error'),
  retry: t('inventory.new.search.retry'),
  count: t(
    'inventory.new.search.count',
    { count: search.results.value.length },
    search.results.value.length,
  ),
}));

/** The big art when the catalog has it, otherwise the small one. */
const art = computed(() => artUrl(picked.value?.image_high_url) ?? artUrl(picked.value?.image_url));

// ---- Step 2: the data of the physical card
const form = useForm({
  validationSchema: toFormSchema(cardFormSchema),
  initialValues: {
    language: 'PT',
    condition: '',
    isFoil: false,
    notes: '',
    origin: '',
    consignorId: '',
    commission: DEFAULT_COMMISSION,
  },
});
const [language] = form.defineField('language');
const [condition] = form.defineField('condition');
const [isFoil] = form.defineField('isFoil');
const [notes] = form.defineField('notes');
const [origin] = form.defineField('origin');
const [commission] = form.defineField('commission');

function fieldError(name: keyof typeof form.errors.value): string | null {
  const key = form.errors.value[name];
  return key ? t(key) : null;
}

const photos = ref<File[]>([]);

function photoProblem(name: string, reason: PhotoProblem): string {
  return t(`inventory.new.photos.problems.${reason}`, { name });
}

// ---- Origin and consignor
const consigned = computed(() => origin.value === 'CONSIGNED');
const consignor = ref<Customer | null>(null);
const consignorText = ref('');
const consignorSearch = useCustomerSearch(consignorText);

const consignorLabels = computed(() => ({
  label: t('inventory.new.consignor.search.label'),
  hint: t('inventory.new.consignor.search.hint'),
  loading: t('inventory.new.consignor.search.loading'),
  none: t('inventory.new.consignor.search.none', { text: consignorText.value.trim() }),
  error: t('inventory.new.consignor.search.error'),
  retry: t('inventory.new.search.retry'),
  count: t(
    'inventory.new.consignor.search.count',
    { count: consignorSearch.results.value.length },
    consignorSearch.results.value.length,
  ),
}));

function chooseOrigin(next: 'OWN' | 'CONSIGNED') {
  origin.value = next;
  form.setFieldError('origin', undefined);
}

function chooseConsignor(customer: Customer) {
  consignor.value = customer;
  form.setFieldValue('consignorId', customer.id);
  consignorText.value = '';
}

function changeConsignor() {
  consignor.value = null;
  form.setFieldValue('consignorId', '');
}

// ---- Saving
const busy = ref(false);
const submitError = ref<string | null>(null);

interface Saved {
  id: string;
  code: string;
  title: string;
  failedPhotos: string[];
  link: string | null;
  linkError: string | null;
  whatsapp: string | null;
}
const saved = ref<Saved | null>(null);
const confirmation = ref<HTMLElement | null>(null);

watch(saved, async (value) => {
  if (!value) return;
  await nextTick();
  confirmation.value?.focus();
});

async function sendPhotos(cardId: string): Promise<string[]> {
  const failed: string[] = [];
  for (const file of photos.value) {
    try {
      await inventoryApi.addPhoto(cardId, file);
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
}

/** The consignor's tracking link, made when the card is saved (it needs the CPF registered). */
async function makeLink(customer: Customer) {
  try {
    const { token } = await customersApi.createConsignorLink(customer.id);
    const link = consignorLinkUrl(window.location.origin, token);
    return {
      link,
      linkError: null,
      whatsapp: whatsappUrl(
        customer.phone,
        t('inventory.new.consignor.message', { name: customer.name, link }),
      ),
    };
  } catch (error) {
    return { link: null, linkError: errorMessage(error), whatsapp: null };
  }
}

const submit = form.handleSubmit(async (values) => {
  const card = picked.value;
  if (!card) return;
  busy.value = true;
  submitError.value = null;
  try {
    const created = await inventoryApi.create(toCreateBody(card.id, values));
    const failedPhotos = await sendPhotos(created.id);
    const customer = values.origin === 'CONSIGNED' ? consignor.value : null;
    const extra = customer
      ? await makeLink(customer)
      : { link: null, linkError: null, whatsapp: null };
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });

    const title = cardTitle(created.catalog);
    if (failedPhotos.length === 0 && !customer) {
      toast.success(t('inventory.new.saved.toast', { title }));
      await navigateTo(`/inventory/${created.id}`);
      return;
    }
    saved.value = { id: created.id, code: created.short_code, title, failedPhotos, ...extra };
  } catch (error) {
    submitError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
});

async function copyLink() {
  if (!saved.value?.link) return;
  try {
    await navigator.clipboard.writeText(saved.value.link);
    toast.info(t('inventory.new.saved.copied'));
  } catch {
    toast.error(t('inventory.new.saved.copyFailed'));
  }
}

/** Starts again with an empty form (after a card that went with a link or a photo that failed). */
function registerAnother() {
  saved.value = null;
  picked.value = null;
  text.value = '';
  photos.value = [];
  consignor.value = null;
  consignorText.value = '';
  submitError.value = null;
  form.resetForm();
}

const originHint = computed(() => (origin.value ? null : t('inventory.new.origin.choose')));
const languageName = (code: string) =>
  te(`inventory.languages.${code}`) ? t(`inventory.languages.${code}`) : code;
</script>

<template>
  <div class="stack">
    <div class="crumb">
      <NuxtLink to="/inventory">{{ t('nav.inventory') }}</NuxtLink> / {{ t('inventory.new.title') }}
    </div>

    <!-- After saving: what happened, and the link when the card is consigned -->
    <AppCard v-if="saved" as="section" highlight body-class="stack">
      <h2 ref="confirmation" tabindex="-1">{{ t('inventory.new.saved.title') }}</h2>
      <p>{{ t('inventory.new.saved.text', { code: `#${saved.code}`, title: saved.title }) }}</p>

      <div v-if="saved.failedPhotos.length > 0" class="alert alert--warning" role="alert">
        <div class="alert__body">
          <p class="alert__title">{{ t('inventory.new.saved.photosFailed') }}</p>
          <span class="muted">{{ saved.failedPhotos.join(' · ') }}</span>
        </div>
      </div>

      <div v-if="saved.link" class="card consignor-link">
        <div class="card__body stack">
          <b>{{ t('inventory.new.consignor.link.title') }}</b>
          <span class="mono consignor-link__url">{{ saved.link }}</span>
          <span class="muted">{{ t('inventory.new.consignor.link.key') }}</span>
          <div class="row">
            <AppButton size="sm" @click="copyLink">
              <AppIcon name="copy" />
              {{ t('inventory.new.consignor.link.copy') }}
            </AppButton>
            <a
              v-if="saved.whatsapp"
              class="btn btn--secondary btn--sm"
              :href="saved.whatsapp"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AppIcon name="message" />
              {{ t('inventory.new.consignor.link.whatsapp') }}
            </a>
          </div>
        </div>
      </div>
      <div v-else-if="saved.linkError" class="alert alert--warning" role="alert">
        <div class="alert__body">
          <p class="alert__title">{{ t('inventory.new.consignor.link.failed') }}</p>
          <span class="muted">{{ saved.linkError }}</span>
        </div>
      </div>

      <div class="row">
        <AppButton variant="primary" :to="`/inventory/${saved.id}`">
          {{ t('inventory.new.saved.open') }}
        </AppButton>
        <AppButton @click="registerAnother">{{ t('inventory.new.saved.another') }}</AppButton>
      </div>
    </AppCard>

    <template v-else>
      <AppCard
        as="section"
        :title="t('inventory.new.search.title')"
        :aria-label="t('inventory.new.search.title')"
      >
        <div class="catalog__layout">
          <CatalogSearch
            v-model:query="text"
            :results="search.results.value"
            :loading="search.loading.value"
            :error="search.error.value"
            :labels="searchLabels"
            @select="picked = $event"
            @retry="search.retry()"
          />

          <div class="catalog__picked" aria-live="polite">
            <div class="tcg catalog__art">
              <img
                v-if="art"
                :src="art"
                :alt="t('inventory.new.picked.art', { name: picked?.name ?? '' })"
                decoding="async"
                referrerpolicy="no-referrer"
              />
              <div v-else class="tcg__ph">
                {{
                  picked ? t('inventory.new.picked.noArt') : t('inventory.new.picked.placeholder')
                }}
              </div>
            </div>
            <span v-if="picked" class="muted catalog__caption">
              <b>{{ picked.name }}</b>
              <br />
              {{ picked.set_name }} · {{ picked.number }}
              <template v-if="picked.rarity">
                <br />
                {{ t('inventory.new.picked.rarity', { rarity: picked.rarity }) }}
              </template>
            </span>
            <span v-else class="muted catalog__caption">{{ t('inventory.new.picked.empty') }}</span>
          </div>
        </div>
      </AppCard>

      <form v-if="picked" class="stack" novalidate @submit.prevent="submit">
        <div class="cols-2 cols-2--stretch">
          <AppCard
            as="section"
            :title="t('inventory.new.data.title')"
            :aria-label="t('inventory.new.data.title')"
            body-class="stack"
          >
            <p class="muted">
              <b>{{ picked.name }}</b> · {{ picked.set_name }} · {{ picked.number }}
              <template v-if="picked.rarity">
                · {{ t('inventory.new.picked.rarity', { rarity: picked.rarity }) }}
              </template>
            </p>
            <div class="form-grid">
              <AppSelect
                v-model="language"
                :label="t('inventory.new.data.language')"
                :error="fieldError('language')"
                name="language"
              >
                <option v-for="code in CARD_LANGUAGES" :key="code" :value="code">
                  {{ languageName(code) }}
                </option>
              </AppSelect>
              <AppSelect
                v-model="condition"
                :label="t('inventory.new.data.condition')"
                :error="fieldError('condition')"
                name="condition"
              >
                <option value="" disabled>{{ t('inventory.new.data.choose') }}</option>
                <option v-for="code in CARD_CONDITIONS" :key="code" :value="code">
                  {{ code }} · {{ t(`inventory.conditions.${code}`) }}
                </option>
              </AppSelect>
              <div class="full">
                <AppSwitch v-model="isFoil">{{ t('inventory.new.data.foil') }}</AppSwitch>
              </div>
              <div class="full">
                <PhotoPicker
                  v-model:files="photos"
                  :label="t('inventory.new.photos.label')"
                  :add="t('inventory.new.photos.add')"
                  :hint="t('inventory.new.photos.hint')"
                  :remove="(position: number) => t('inventory.new.photos.remove', { position })"
                  :preview="(position: number) => t('inventory.new.photos.preview', { position })"
                  :problem="photoProblem"
                  :disabled="busy"
                />
              </div>
              <div class="full">
                <AppTextarea
                  v-model="notes"
                  :label="t('inventory.new.data.notes')"
                  :error="fieldError('notes')"
                  :placeholder="t('inventory.new.data.notesPlaceholder')"
                  name="notes"
                  maxlength="2000"
                />
              </div>
            </div>
          </AppCard>

          <AppCard
            as="section"
            :title="t('inventory.new.origin.title')"
            :aria-label="t('inventory.new.origin.title')"
            body-class="stack"
          >
            <div class="seg" role="group" :aria-label="t('inventory.new.origin.title')">
              <button
                type="button"
                :class="{ 'is-active': origin === 'OWN' }"
                :aria-pressed="origin === 'OWN'"
                @click="chooseOrigin('OWN')"
              >
                {{ t('inventory.new.origin.own') }}
              </button>
              <button
                type="button"
                :class="{ 'is-active': origin === 'CONSIGNED' }"
                :aria-pressed="origin === 'CONSIGNED'"
                @click="chooseOrigin('CONSIGNED')"
              >
                {{ t('inventory.new.origin.consigned') }}
              </button>
            </div>
            <span v-if="originHint" class="muted inventory__hint">{{ originHint }}</span>

            <div v-if="consigned" class="stack">
              <div v-if="consignor" class="row consignor-picked">
                <span class="grow">
                  <b>{{ consignor.name }}</b>
                  <span class="muted">
                    · {{ consignor.cpf_masked ?? `…${consignor.phone.slice(-4)}` }}</span
                  >
                </span>
                <AppButton size="sm" variant="ghost" @click="changeConsignor">
                  {{ t('inventory.new.consignor.change') }}
                </AppButton>
              </div>
              <CustomerSearch
                v-else
                v-model:query="consignorText"
                :results="consignorSearch.results.value"
                :loading="consignorSearch.loading.value"
                :error="consignorSearch.error.value"
                :labels="consignorLabels"
                @select="chooseConsignor"
                @retry="consignorSearch.retry()"
              />
              <p v-if="fieldError('consignorId')" role="alert" class="hint hint--error">
                {{ fieldError('consignorId') }}
              </p>
              <div
                v-if="consignor && !consignor.cpf_masked"
                class="alert alert--warning"
                role="status"
              >
                <div class="alert__body">{{ t('inventory.new.consignor.noCpf') }}</div>
              </div>
              <AppInput
                v-model="commission"
                :label="t('inventory.new.consignor.commission')"
                :error="fieldError('commission')"
                name="commission"
                inputmode="decimal"
                autocomplete="off"
              />
              <div class="card consignor-link">
                <div class="card__body stack">
                  <b>{{ t('inventory.new.consignor.link.title') }}</b>
                  <span class="muted">{{ t('inventory.new.consignor.link.whenSaved') }}</span>
                  <span class="muted inventory__hint">{{
                    t('inventory.new.consignor.link.needsCpf')
                  }}</span>
                </div>
              </div>
            </div>
          </AppCard>
        </div>

        <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
        <div class="row inventory__actions">
          <AppButton to="/inventory">{{ t('inventory.new.cancel') }}</AppButton>
          <AppButton
            type="submit"
            variant="primary"
            :busy="busy"
            :disabled="!origin"
            :title="origin ? undefined : t('inventory.new.origin.choose')"
          >
            {{ t('inventory.new.save') }}
          </AppButton>
        </div>
      </form>
    </template>
  </div>
</template>
