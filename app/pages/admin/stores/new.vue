<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createAdminApi, type AdminUser } from '../../../api/admin';
import {
  CARD_LIMIT_MAX,
  MEMBER_LIMIT_DEFAULT,
  MEMBER_LIMIT_MAX,
  prefillFromRequest,
  toNewStore,
  type StoreFormError,
} from '../../../utils/admin-stores';

definePageMeta({
  i18n: false,
  layout: 'admin',
  titleKey: 'admin.stores.new.title',
  access: { level: 'admin' },
});

/** An access request turned into a store: `/admin/stores/new?request=<id>`. */
const REQUEST_LOOKUP = 100;

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const errorMessage = useErrorMessage();
const queryClient = useQueryClient();
const api = createAdminApi(useApi());

const requestId = computed(() => {
  const raw = Array.isArray(route.query.request) ? route.query.request[0] : route.query.request;
  return typeof raw === 'string' && raw !== '' ? raw : undefined;
});

const name = ref('');
const city = ref('');
const plan = ref('');
const memberLimit = ref(String(MEMBER_LIMIT_DEFAULT));
const cardLimit = ref('');
const mode = ref<'new' | 'existing'>('new');
const ownerEmail = ref('');
const ownerText = ref('');
const chosen = ref<AdminUser | null>(null);
const userSearch = useUserSearch(ownerText);

// The access request that is being converted tells the store and the e-mail of who asked.
const request = useQuery({
  queryKey: computed(() => ['admin', 'access-request', requestId.value]),
  queryFn: async ({ signal }) => {
    const page = await api.accessRequests('PENDING', REQUEST_LOOKUP, signal);
    return page.items.find((item) => item.id === requestId.value) ?? null;
  },
  enabled: computed(() => requestId.value !== undefined),
});
watch(
  () => request.data.value,
  (found) => {
    if (!found) return;
    const fill = prefillFromRequest(found);
    if (name.value === '') name.value = fill.name;
    if (ownerEmail.value === '') ownerEmail.value = fill.ownerEmail;
  },
  { immediate: true },
);

const errors = reactive<Partial<Record<StoreFormError, string>>>({});
const failure = ref<string | null>(null);
const busy = ref(false);

const MESSAGES: Record<StoreFormError, string> = {
  nameRequired: 'admin.stores.new.errors.nameRequired',
  nameTooLong: 'validation.tooLong',
  cityTooLong: 'validation.tooLong',
  planInvalid: 'admin.stores.new.errors.planInvalid',
  memberLimit: 'admin.stores.new.errors.memberLimit',
  cardLimit: 'admin.stores.new.errors.cardLimit',
  ownerEmail: 'admin.stores.new.errors.ownerEmail',
  ownerUser: 'admin.stores.new.errors.ownerUser',
};

function pick(user: AdminUser) {
  chosen.value = user;
  ownerText.value = user.email;
  errors.ownerUser = undefined;
}

async function create() {
  for (const key of Object.keys(MESSAGES) as StoreFormError[]) errors[key] = undefined;
  failure.value = null;
  const result = toNewStore({
    name: name.value,
    city: city.value,
    plan: plan.value,
    memberLimit: memberLimit.value,
    cardLimit: cardLimit.value,
    owner:
      mode.value === 'new'
        ? { mode: 'new', email: ownerEmail.value }
        : { mode: 'existing', userId: chosen.value?.id ?? null },
    accessRequestId: requestId.value,
  });
  if ('errors' in result) {
    for (const key of Object.keys(result.errors) as StoreFormError[])
      errors[key] = t(MESSAGES[key]);
    return;
  }
  busy.value = true;
  try {
    const created = await api.createStore(result.store);
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    const owner = result.store.owner_email ?? chosen.value?.email ?? '';
    toast.success(
      t(
        created.owner_state === 'INVITED'
          ? 'admin.stores.new.createdInvited'
          : 'admin.stores.new.created',
        {
          store: created.store.name,
          email: owner,
        },
      ),
    );
    await navigateTo('/admin/stores');
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

const searchLabels = computed(() => ({
  label: t('admin.stores.new.owner.search'),
  hint: t('admin.stores.transfer.hint'),
  loading: t('admin.stores.transfer.loading'),
  none: t('admin.stores.transfer.none', { text: ownerText.value }),
  error: t('admin.stores.transfer.error'),
  retry: t('admin.stores.transfer.retry'),
  count: t(
    'admin.stores.transfer.count',
    { count: userSearch.results.value.length },
    userSearch.results.value.length,
  ),
}));
</script>

<template>
  <form class="stack" novalidate @submit.prevent="create">
    <div class="crumb">
      <NuxtLink to="/admin/stores">{{ t('admin.stores.title') }}</NuxtLink> /
      {{ t('admin.stores.new.title') }}
    </div>

    <p v-if="requestId && request.data.value" class="hint" role="status">
      {{ t('admin.stores.new.fromRequest', { name: request.data.value.name }) }}
    </p>

    <AppCard as="section" :aria-label="t('admin.stores.new.data')">
      <div class="card__head">
        <h2 class="card__title">{{ t('admin.stores.new.data') }}</h2>
      </div>
      <div class="card__body">
        <div class="form-grid">
          <AppInput
            v-model="name"
            :label="t('admin.stores.new.name')"
            :error="errors.nameRequired ?? errors.nameTooLong"
            name="name"
            maxlength="120"
            autocomplete="off"
            :placeholder="t('admin.stores.new.namePlaceholder')"
          />
          <AppInput
            v-model="city"
            :label="t('admin.stores.new.city')"
            :error="errors.cityTooLong"
            name="city"
            autocomplete="off"
            :placeholder="t('admin.stores.new.cityPlaceholder')"
          />
          <AppInput
            v-model="plan"
            :label="t('admin.stores.new.plan')"
            :hint="t('admin.stores.new.planHint')"
            :error="errors.planInvalid"
            name="plan"
            maxlength="20"
            autocomplete="off"
          />
          <AppInput
            v-model="memberLimit"
            :label="t('admin.stores.new.memberLimit')"
            :error="errors.memberLimit"
            type="number"
            name="memberLimit"
            min="1"
            :max="MEMBER_LIMIT_MAX"
          />
          <AppInput
            v-model="cardLimit"
            :label="t('admin.stores.new.cardLimit')"
            :hint="t('admin.stores.new.cardLimitHint')"
            :error="errors.cardLimit"
            type="number"
            name="cardLimit"
            min="1"
            :max="CARD_LIMIT_MAX"
          />
        </div>
      </div>
    </AppCard>

    <AppCard as="section" :aria-label="t('admin.stores.new.owner.title')">
      <div class="card__head">
        <h2 class="card__title">{{ t('admin.stores.new.owner.title') }}</h2>
      </div>
      <div class="card__body stack">
        <div class="seg" role="group" :aria-label="t('admin.stores.new.owner.title')">
          <button
            type="button"
            :class="{ 'is-active': mode === 'new' }"
            :aria-pressed="mode === 'new'"
            @click="mode = 'new'"
          >
            {{ t('admin.stores.new.owner.new') }}
          </button>
          <button
            type="button"
            :class="{ 'is-active': mode === 'existing' }"
            :aria-pressed="mode === 'existing'"
            @click="mode = 'existing'"
          >
            {{ t('admin.stores.new.owner.existing') }}
          </button>
        </div>

        <AppInput
          v-if="mode === 'new'"
          v-model="ownerEmail"
          :label="t('admin.stores.new.owner.email')"
          :error="errors.ownerEmail"
          type="email"
          name="ownerEmail"
          autocomplete="off"
          :placeholder="t('admin.stores.new.owner.emailPlaceholder')"
        />
        <div v-else class="stack">
          <UserSearch
            v-model:query="ownerText"
            :results="userSearch.results.value"
            :loading="userSearch.loading.value"
            :error="userSearch.error.value"
            :labels="searchLabels"
            @select="pick"
            @retry="userSearch.retry()"
          />
          <p v-if="chosen" class="hint" role="status">
            {{ t('admin.stores.transfer.chosen', { email: chosen.email }) }}
          </p>
          <p v-if="errors.ownerUser" class="hint hint--error">{{ errors.ownerUser }}</p>
        </div>

        <p class="muted">{{ t('admin.stores.new.owner.hint') }}</p>
      </div>
    </AppCard>

    <p v-if="failure" role="alert" class="hint hint--error">{{ failure }}</p>
    <div class="row admin__actions">
      <AppButton to="/admin/stores">{{ t('admin.cancel') }}</AppButton>
      <AppButton type="submit" variant="primary" :busy="busy">
        {{ t('admin.stores.new.submit') }}
      </AppButton>
    </div>
  </form>
</template>
