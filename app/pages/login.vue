<script setup lang="ts">
import { z } from 'zod';
import { useForm } from 'vee-validate';
import { toFormSchema } from '../utils/zod-schema';

const DEFAULT_PATH = '/stores';

const { t } = useI18n();
const session = useSessionStore();
const route = useRoute();
const errorMessage = useErrorMessage();
const toast = useToast();

definePageMeta({ i18n: false, layout: 'public' });

useHead({ title: () => t('auth.login.title'), meta: [{ name: 'robots', content: 'noindex' }] });

/** Back to the page that asked for the login, if it is a path inside this app. */
const afterLoginPath = computed(() => safeRedirectPath(route.query.redirect) ?? DEFAULT_PATH);

const step = ref<'email' | 'code'>('email');
const email = ref('');
const busy = ref(false);
const submitError = ref<string | null>(null);
const emailInput = ref<{ focus: () => void } | null>(null);
const otpInput = ref<{ focus: () => void } | null>(null);

const emailForm = useForm({
  validationSchema: toFormSchema(
    z.object({
      email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')),
    }),
  ),
  initialValues: { email: '' },
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
  initialValues: { code: '' },
});
// The code is checked when it is submitted, not while the 6 digits are still being typed.
const [codeField] = codeForm.defineField('code', { validateOnModelUpdate: false });
watch(codeField, () => codeForm.setFieldError('code', undefined));

const emailError = computed(() => {
  const key = emailForm.errors.value.email;
  return key ? t(key) : null;
});

const codeError = computed(() => {
  const key = codeForm.errors.value.code;
  return key ? t(key) : null;
});

const codeDescribedby = computed(() => (codeError.value ? 'code-sent code-error' : 'code-sent'));

const digitLabel = (position: number, total: number) => t('auth.code.digit', { position, total });

async function goTo(next: 'email' | 'code') {
  step.value = next;
  submitError.value = null;
  await nextTick();
  (next === 'code' ? otpInput : emailInput).value?.focus();
}

/** Runs a request with the button busy. Resolves to false when it failed (the error is shown). */
async function run(action: () => Promise<void>): Promise<boolean> {
  busy.value = true;
  submitError.value = null;
  try {
    await action();
    return true;
  } catch (error) {
    submitError.value = errorMessage(error);
    return false;
  } finally {
    busy.value = false;
  }
}

const submitEmail = emailForm.handleSubmit(async (values) => {
  const sent = await run(async () => {
    await session.requestOtp(values.email);
    email.value = values.email;
  });
  // Only now: the boxes are disabled while the request runs, and a disabled box cannot take focus.
  if (sent) await goTo('code');
});

const submitCode = codeForm.handleSubmit((values) =>
  run(async () => {
    await session.login(email.value, values.code);
    await navigateTo(afterLoginPath.value);
  }),
);

async function resend() {
  const sent = await run(() => session.requestOtp(email.value));
  if (sent) toast.success(t('auth.code.resent', { email: email.value }));
}

onMounted(async () => {
  await session.restore();
  if (session.isAuthenticated) await navigateTo(afterLoginPath.value);
});
</script>

<template>
  <main id="main" class="center-page">
    <AppCard class="narrow" highlight body-class="stack">
      <template v-if="step === 'email'">
        <h1>{{ t('auth.login.title') }}</h1>
        <p class="muted">{{ t('auth.login.subtitle') }}</p>

        <form class="stack" novalidate @submit.prevent="submitEmail">
          <AppInput
            ref="emailInput"
            v-model="emailField"
            v-bind="emailAttrs"
            :label="t('auth.login.email')"
            :error="emailError"
            type="email"
            name="email"
            autocomplete="email"
            inputmode="email"
          />
          <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
          <AppButton type="submit" variant="primary" size="lg" block :busy="busy">
            {{ t('auth.login.sendCode') }}
          </AppButton>
        </form>

        <div class="row">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>

        <p class="faint">
          {{ t('auth.login.inviteOnly') }}
          <NuxtLink to="/request-access">{{ t('auth.login.requestAccess') }}</NuxtLink>
        </p>
      </template>

      <template v-else>
        <h1>{{ t('auth.code.title') }}</h1>
        <p id="code-sent" class="muted">{{ t('auth.code.sentTo', { email }) }}</p>

        <form class="stack" novalidate @submit.prevent="submitCode">
          <div class="field">
            <AppOtpInput
              ref="otpInput"
              v-model="codeField"
              :label="t('auth.code.label')"
              :digit-label="digitLabel"
              :invalid="Boolean(codeError)"
              :disabled="busy"
              :describedby="codeDescribedby"
            />
            <p v-if="codeError" id="code-error" class="hint hint--error">{{ codeError }}</p>
          </div>
          <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
          <AppButton type="submit" variant="primary" size="lg" block :busy="busy">
            {{ t('auth.code.submit') }}
          </AppButton>
        </form>

        <div class="row">
          <AppButton variant="ghost" size="sm" :disabled="busy" @click="resend">
            {{ t('auth.code.resend') }}
          </AppButton>
          <AppButton variant="ghost" size="sm" @click="goTo('email')">
            {{ t('auth.code.changeEmail') }}
          </AppButton>
        </div>
      </template>
    </AppCard>
  </main>
</template>
