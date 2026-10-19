<script setup lang="ts">
import { z } from 'zod';
import { useForm } from 'vee-validate';
import { toFormSchema } from '../utils/zod-schema';

const DEFAULT_PATH = '/stores';

const { t } = useI18n();
const session = useSessionStore();
const route = useRoute();
const errorMessage = useErrorMessage();

definePageMeta({ i18n: false });

useHead({ title: () => t('auth.login.title'), meta: [{ name: 'robots', content: 'noindex' }] });

/** Back to the page that asked for the login, if it is a path inside this app. */
const afterLoginPath = computed(() => safeRedirectPath(route.query.redirect) ?? DEFAULT_PATH);

const step = ref<'email' | 'code'>('email');
const email = ref('');
const busy = ref(false);
const submitError = ref<string | null>(null);
const headingRef = ref<HTMLElement | null>(null);

const emailForm = useForm({
  validationSchema: toFormSchema(
    z.object({
      email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')),
    }),
  ),
});
const [emailField, emailAttrs] = emailForm.defineField('email');

const codeForm = useForm({
  validationSchema: toFormSchema(
    z.object({
      code: z
        .string()
        .trim()
        .min(1, 'validation.required')
        .regex(/^\d{6}$/, 'validation.otpCode'),
    }),
  ),
});
const [codeField, codeAttrs] = codeForm.defineField('code');

async function goTo(next: 'email' | 'code') {
  step.value = next;
  submitError.value = null;
  await nextTick();
  headingRef.value?.focus();
}

async function run(action: () => Promise<void>) {
  busy.value = true;
  submitError.value = null;
  try {
    await action();
  } catch (error) {
    submitError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

const submitEmail = emailForm.handleSubmit((values) =>
  run(async () => {
    await session.requestOtp(values.email);
    email.value = values.email;
    await goTo('code');
  }),
);

const submitCode = codeForm.handleSubmit((values) =>
  run(async () => {
    await session.login(email.value, values.code);
    await navigateTo(afterLoginPath.value);
  }),
);

function resend() {
  return run(() => session.requestOtp(email.value));
}

onMounted(async () => {
  await session.restore();
  if (session.isAuthenticated) await navigateTo(afterLoginPath.value);
});
</script>

<template>
  <main id="main" class="center-page">
    <section class="card narrow">
      <div class="card__body stack">
        <template v-if="step === 'email'">
          <h1 ref="headingRef" tabindex="-1">{{ t('auth.login.title') }}</h1>
          <p class="muted">{{ t('auth.login.subtitle') }}</p>

          <form class="stack" novalidate @submit.prevent="submitEmail">
            <div class="field">
              <label class="label" for="email">
                <span>{{ t('auth.login.email') }}</span>
                <input
                  id="email"
                  v-model="emailField"
                  v-bind="emailAttrs"
                  class="input"
                  type="email"
                  name="email"
                  autocomplete="email"
                  inputmode="email"
                  :aria-invalid="emailForm.errors.value.email ? 'true' : undefined"
                  :aria-describedby="emailForm.errors.value.email ? 'email-error' : undefined"
                />
              </label>
              <p v-if="emailForm.errors.value.email" id="email-error" class="field__error">
                {{ t(emailForm.errors.value.email) }}
              </p>
            </div>
            <p v-if="submitError" role="alert" class="field__error">{{ submitError }}</p>
            <button class="btn btn--primary btn--lg btn--block" type="submit" :disabled="busy">
              {{ t('auth.login.sendCode') }}
            </button>
          </form>

          <LanguageSwitcher />

          <p class="faint">
            {{ t('auth.login.inviteOnly') }}
            <NuxtLink to="/request-access">{{ t('auth.login.requestAccess') }}</NuxtLink>
          </p>
        </template>

        <template v-else>
          <h1 ref="headingRef" tabindex="-1">{{ t('auth.code.title') }}</h1>
          <p class="muted">{{ t('auth.code.sentTo', { email }) }}</p>

          <form class="stack" novalidate @submit.prevent="submitCode">
            <div class="field">
              <label class="label" for="code">
                <span>{{ t('auth.code.label') }}</span>
                <input
                  id="code"
                  v-model="codeField"
                  v-bind="codeAttrs"
                  class="input"
                  type="text"
                  name="code"
                  autocomplete="one-time-code"
                  inputmode="numeric"
                  maxlength="6"
                  :aria-invalid="codeForm.errors.value.code ? 'true' : undefined"
                  :aria-describedby="codeForm.errors.value.code ? 'code-error' : undefined"
                />
              </label>
              <p v-if="codeForm.errors.value.code" id="code-error" class="field__error">
                {{ t(codeForm.errors.value.code) }}
              </p>
            </div>
            <p v-if="submitError" role="alert" class="field__error">{{ submitError }}</p>
            <button class="btn btn--primary btn--lg btn--block" type="submit" :disabled="busy">
              {{ t('auth.code.submit') }}
            </button>
          </form>

          <div class="row">
            <button class="btn btn--ghost btn--sm" type="button" :disabled="busy" @click="resend">
              {{ t('auth.code.resend') }}
            </button>
            <button class="btn btn--ghost btn--sm" type="button" @click="goTo('email')">
              {{ t('auth.code.changeEmail') }}
            </button>
          </div>
        </template>
      </div>
    </section>
  </main>
</template>
