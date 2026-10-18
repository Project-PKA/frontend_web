<script setup lang="ts">
import { z } from 'zod';
import { useForm } from 'vee-validate';
import { useQuery } from '@tanstack/vue-query';
import { createStoresApi } from '../../api/stores';
import { toFormSchema } from '../../utils/zod-schema';

definePageMeta({ i18n: false, layout: 'public', access: { level: 'session' } });

const { t } = useI18n();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const api = createStoresApi(useApi());

useHead({ title: () => t('stores.new.title'), meta: [{ name: 'robots', content: 'noindex' }] });

const me = useQuery({
  queryKey: ['me'],
  queryFn: async () => {
    await access.loadMe();
    return access.me;
  },
});

/** The global permission is the administrator's to give: without it there is nothing to do here. */
const allowed = computed(() => me.data.value?.can_create_stores === true);

const form = useForm({
  validationSchema: toFormSchema(
    z.object({
      name: z.string().trim().min(1, 'validation.required').max(120, 'validation.tooLong'),
    }),
  ),
  initialValues: { name: '' },
});
const [name, nameAttrs] = form.defineField('name');
const nameError = computed(() => {
  const key = form.errors.value.name;
  return key ? t(key) : null;
});

const busy = ref(false);
const submitError = ref<string | null>(null);

const submit = form.handleSubmit(async (values) => {
  busy.value = true;
  submitError.value = null;
  try {
    const created = await api.create(values.name);
    access.selectStore(created.id);
    toast.success(t('stores.new.created', { name: created.name }));
    await navigateTo('/home');
  } catch (error) {
    submitError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
});
</script>

<template>
  <main id="main" class="center-page">
    <div class="narrow-lg stack">
      <div>
        <span class="crumb">
          <NuxtLink to="/stores">← {{ t('stores.new.back') }}</NuxtLink>
        </span>
        <h1 class="store-picker__title">{{ t('stores.new.title') }}</h1>
      </div>

      <AppState v-if="me.isPending.value" kind="loading" :title="t('stores.loading')" />
      <AppState
        v-else-if="me.isError.value"
        kind="error"
        :title="t('stores.error.title')"
        :text="t('stores.error.text')"
        :action-label="t('stores.error.retry')"
        @action="me.refetch()"
      />
      <AppState
        v-else-if="!allowed"
        kind="empty"
        :title="t('stores.new.notAllowed.title')"
        :text="t('stores.new.notAllowed.text')"
      />

      <form v-else class="stack" novalidate @submit.prevent="submit">
        <p class="muted">{{ t('stores.new.intro') }}</p>

        <AppCard :title="t('stores.new.step1')" body-class="stack">
          <AppInput
            v-model="name"
            v-bind="nameAttrs"
            :label="t('stores.new.name')"
            :error="nameError"
            name="name"
            autocomplete="organization"
            maxlength="120"
          />
        </AppCard>

        <AppCard :title="t('stores.new.step2')" body-class="stack">
          <template #head>
            <AppBadge tone="dashed">{{ t('stores.new.afterCreate') }}</AppBadge>
          </template>
          <p class="muted">{{ t('stores.new.step2Text') }}</p>
        </AppCard>

        <AppCard :title="t('stores.new.step3')" body-class="stack">
          <template #head>
            <AppBadge tone="dashed">{{ t('stores.new.afterCreate') }}</AppBadge>
          </template>
          <p class="muted">{{ t('stores.new.step3Text') }}</p>
        </AppCard>

        <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>

        <div class="row store-picker__actions">
          <AppButton to="/stores">{{ t('stores.new.cancel') }}</AppButton>
          <AppButton type="submit" variant="primary" :busy="busy">
            {{ t('stores.new.submit') }}
          </AppButton>
        </div>
      </form>
    </div>
  </main>
</template>
