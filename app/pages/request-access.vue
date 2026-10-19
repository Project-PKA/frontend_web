<script setup lang="ts">
import { useForm } from 'vee-validate';
import { createAccessRequestsApi } from '../api/access-requests';
import { accessRequestSchema, toAccessRequestBody } from '../utils/access-request';
import { maskBrazilPhone } from '../utils/phone';
import { toFormSchema } from '../utils/zod-schema';

definePageMeta({ i18n: false, layout: 'public' });

const { t } = useI18n();
const errorMessage = useErrorMessage();
const api = createAccessRequestsApi(usePublicApi());

useHead({
  title: () => t('requestAccess.title'),
  meta: [{ name: 'description', content: () => t('requestAccess.description') }],
});

const form = useForm({
  validationSchema: toFormSchema(accessRequestSchema),
  initialValues: { name: '', email: '', whatsapp: '', storeName: '', message: '' },
});
const [name, nameAttrs] = form.defineField('name');
const [email, emailAttrs] = form.defineField('email');
const [whatsapp] = form.defineField('whatsapp');
const [storeName, storeNameAttrs] = form.defineField('storeName');
const [message, messageAttrs] = form.defineField('message');

// The WhatsApp number is formatted as it is typed.
watch(whatsapp, (value) => {
  const masked = maskBrazilPhone(value ?? '');
  if (masked !== value) whatsapp.value = masked;
});

const error = (field: 'name' | 'email' | 'whatsapp' | 'storeName' | 'message') => {
  const key = form.errors.value[field];
  return key ? t(key) : null;
};

/**
 * The decoy field. A person never sees it, so it stays empty. A script that fills every input
 * it finds fills this one too: such a request is dropped here and looks like it worked.
 */
const decoy = ref('');
const confirmation = ref<HTMLElement | null>(null);

const busy = ref(false);
const submitError = ref<string | null>(null);
const sentTo = ref<string | null>(null);

// The form goes away when the request is sent: keep the focus on what replaces it.
watch(sentTo, async (value) => {
  if (!value) return;
  await nextTick();
  confirmation.value?.focus();
});

const submit = form.handleSubmit(async (values) => {
  if (decoy.value !== '') {
    sentTo.value = values.email;
    return;
  }
  busy.value = true;
  submitError.value = null;
  try {
    await api.request(toAccessRequestBody(values));
    sentTo.value = values.email;
  } catch (failure) {
    submitError.value = errorMessage(failure);
  } finally {
    busy.value = false;
  }
});
</script>

<template>
  <main id="main" class="center-page">
    <AppCard v-if="sentTo" class="narrow" highlight body-class="stack">
      <span class="brand__mark invite__mark" aria-hidden="true" />
      <h1 ref="confirmation" tabindex="-1">{{ t('requestAccess.sent.title') }}</h1>
      <p class="muted">{{ t('requestAccess.sent.text', { email: sentTo }) }}</p>
      <AppButton to="/" variant="primary">{{ t('requestAccess.sent.home') }}</AppButton>
    </AppCard>

    <AppCard v-else class="narrow" body-class="stack">
      <span class="brand__mark invite__mark" aria-hidden="true" />
      <div>
        <h1>{{ t('requestAccess.title') }}</h1>
        <p class="muted">{{ t('requestAccess.intro') }}</p>
      </div>

      <form class="stack" novalidate @submit.prevent="submit">
        <AppInput
          v-model="name"
          v-bind="nameAttrs"
          :label="t('requestAccess.name')"
          :error="error('name')"
          name="name"
          autocomplete="name"
          maxlength="120"
        />
        <AppInput
          v-model="email"
          v-bind="emailAttrs"
          :label="t('requestAccess.email')"
          :error="error('email')"
          type="email"
          name="email"
          autocomplete="email"
          inputmode="email"
          maxlength="254"
        />
        <AppInput
          v-model="whatsapp"
          :label="t('requestAccess.whatsapp')"
          :hint="t('requestAccess.whatsappHint')"
          :error="error('whatsapp')"
          type="tel"
          name="whatsapp"
          autocomplete="tel-national"
          inputmode="numeric"
          placeholder="(00) 00000-0000"
          maxlength="15"
        />
        <AppInput
          v-model="storeName"
          v-bind="storeNameAttrs"
          :label="t('requestAccess.storeName')"
          :error="error('storeName')"
          name="store"
          autocomplete="organization"
          maxlength="120"
        />
        <AppTextarea
          v-model="message"
          v-bind="messageAttrs"
          :label="t('requestAccess.message')"
          :error="error('message')"
          :placeholder="t('requestAccess.messagePlaceholder')"
          name="message"
          maxlength="1000"
        />

        <!-- The decoy: out of sight, out of the keyboard and the screen reader. -->
        <div class="visually-hidden" inert aria-hidden="true">
          <label for="website">
            Website
            <input
              id="website"
              v-model="decoy"
              type="text"
              name="website"
              tabindex="-1"
              autocomplete="off"
            />
          </label>
        </div>

        <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
        <AppButton type="submit" variant="primary" size="lg" block :busy="busy">
          {{ t('requestAccess.submit') }}
        </AppButton>
      </form>

      <p class="faint">
        {{ t('requestAccess.reply') }}
        <NuxtLink to="/login">{{ t('requestAccess.haveInvite') }}</NuxtLink>
      </p>
    </AppCard>
  </main>
</template>
