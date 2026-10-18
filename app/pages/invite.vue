<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { ApiError } from '../api/errors';
import { createAuthApi } from '../api/auth';
import { createInvitationsApi } from '../api/invitations';
import { createApiClient } from '../api/client';
import { PERMISSIONS } from '../utils/permissions';
import { tokenFromFragment } from '../utils/fragment-token';

definePageMeta({ i18n: false, layout: 'public' });

const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();
const errorMessage = useErrorMessage();
const format = useFormat();
const config = useRuntimeConfig();

// The token is in the fragment (never in the path or the query), so it does not reach a log.
useHead({
  title: () => t('invite.title'),
  meta: [
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'no-referrer' },
  ],
});

const client = createApiClient({
  baseUrl: config.public.apiBaseUrl,
  getAccessToken: () => null,
  getStoreId: () => null,
  refreshSession: () => Promise.resolve(false),
});
const invitations = createInvitationsApi(client);
const auth = createAuthApi(client);

const token = computed(() => tokenFromFragment(route.hash));

const preview = useQuery({
  queryKey: ['invitation', token],
  queryFn: () => invitations.preview(token.value as string),
  enabled: computed(() => token.value !== null),
  retry: false,
  staleTime: Infinity,
});

/** A missing token and an invalid, expired or revoked one look the same: the API says so too. */
const unavailable = computed(
  () =>
    token.value === null ||
    (preview.error.value instanceof ApiError && preview.error.value.status === 404),
);
const failed = computed(() => preview.isError.value && !unavailable.value);
const loading = computed(() => token.value !== null && preview.isPending.value);
const invitation = computed(() => preview.data.value ?? null);

const isOwner = computed(() => invitation.value?.role === 'OWNER');
const permissionRows = computed(() => {
  const granted = invitation.value?.permissions;
  if (!granted || isOwner.value) return [];
  return PERMISSIONS.map((permission) => ({
    permission,
    label: t(`permissions.${permission}`),
    allowed: granted[permission] === true,
  }));
});

const busy = ref(false);
const submitError = ref<string | null>(null);

/**
 * Accepts the invitation and asks for the login code, so the person lands on the login page
 * already at the code step. If the code cannot be asked for now, they ask for it there.
 */
async function accept() {
  if (!token.value || !invitation.value) return;
  busy.value = true;
  submitError.value = null;
  const email = invitation.value.email;
  try {
    await invitations.accept(token.value);
    let codeSent = true;
    try {
      await auth.requestOtp(email);
    } catch {
      codeSent = false;
    }
    session.setLoginHint(email, codeSent);
    await navigateTo('/login');
  } catch (error) {
    submitError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main id="main" class="center-page">
    <AppState v-if="loading" kind="loading" :title="t('invite.loading')" />

    <AppCard v-else-if="unavailable" class="narrow" body-class="stack">
      <h1>{{ t('invite.invalid.title') }}</h1>
      <p class="muted">{{ t('invite.invalid.text') }}</p>
      <AppButton to="/login">{{ t('invite.invalid.signIn') }}</AppButton>
    </AppCard>

    <AppState
      v-else-if="failed"
      kind="error"
      :title="t('invite.failed.title')"
      :text="t('invite.failed.text')"
      :action-label="t('invite.failed.retry')"
      @action="preview.refetch()"
    />

    <AppCard v-else-if="invitation" class="narrow" highlight body-class="stack">
      <span class="brand__mark invite__mark" aria-hidden="true" />
      <div>
        <h1>{{ t('invite.title') }}</h1>
        <p v-if="invitation.store_name" class="muted">
          {{
            t('invite.introStore', {
              email: invitation.email,
              store: invitation.store_name,
              role: invitation.role ? t(`role.${invitation.role}`) : '',
            })
          }}
        </p>
        <p v-else class="muted">
          {{ t('invite.introPlatform', { email: invitation.email, product: t('brand.name') }) }}
        </p>
      </div>

      <AppCard v-if="permissionRows.length > 0">
        <span class="label">{{ t('invite.permissions') }}</span>
        <div v-for="row in permissionRows" :key="row.permission" class="perm">
          <span :class="{ faint: !row.allowed }">{{ row.label }}</span>
          <AppBadge :tone="row.allowed ? 'success' : 'dashed'">
            {{ row.allowed ? t('invite.yes') : t('invite.no') }}
          </AppBadge>
        </div>
      </AppCard>
      <p v-else-if="isOwner" class="muted">{{ t('invite.ownerAccess') }}</p>

      <p class="faint">
        {{ t('invite.validUntil', { date: format.dateTime(invitation.expires_at) }) }}
      </p>
      <p class="faint">{{ t('invite.hint') }}</p>

      <p v-if="submitError" role="alert" class="hint hint--error">{{ submitError }}</p>
      <AppButton variant="primary" size="lg" block :busy="busy" @click="accept">
        {{ t('invite.accept') }}
      </AppButton>
      <NuxtLink class="invite__decline" to="/">{{ t('invite.decline') }}</NuxtLink>
    </AppCard>
  </main>
</template>
