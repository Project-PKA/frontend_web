<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createAuthApi, type MySessions } from '../api/auth';
import { createStoresApi } from '../api/stores';
import { describeUserAgent } from '../utils/user-agent';
import { timeZoneOptions } from '../utils/timezones';
import { LANGUAGES } from '../utils/language';

definePageMeta({ i18n: false, layout: 'app', titleKey: 'nav.profile', access: { level: 'store' } });

const { t } = useI18n();
const access = useAccessStore();
const session = useSessionStore();
const preferences = usePreferencesStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const authApi = createAuthApi(useApi());
type MySession = MySessions['items'][number];
const storesApi = createStoresApi(useApi());

const me = useQuery({
  queryKey: ['me'],
  queryFn: async () => {
    await access.loadMe();
    return access.me;
  },
});
const profileQuery = useQuery({
  queryKey: ['preferences'],
  queryFn: async () => {
    if (!preferences.profile) await preferences.load();
    return preferences.profile;
  },
});
const stores = useQuery({ queryKey: ['my-stores'], queryFn: () => storesApi.listMine() });
const sessions = useQuery({ queryKey: ['my-sessions'], queryFn: () => authApi.listSessions() });

const ready = computed(() => !!me.data.value && !!profileQuery.data.value);

function retry() {
  void me.refetch();
  void profileQuery.refetch();
}

// Language and theme apply at once (they change the page); the rest is saved with the button.
const timezone = ref('');
const currency = ref('');
const inApp = ref(false);
const email = ref(false);

watch(
  () => preferences.profile,
  (profile) => {
    if (!profile) return;
    timezone.value = profile.timezone;
    currency.value = profile.currency;
    inApp.value = profile.notifications.in_app;
    email.value = profile.notifications.email;
  },
  { immediate: true },
);

const zones = computed(() => timeZoneOptions(preferences.profile?.timezone ?? timezone.value));

/** Only what differs from what is saved: the API changes only what it receives. */
const changes = computed(() => {
  const saved = preferences.profile;
  if (!saved) return {};
  const diff: {
    timezone?: string;
    currency?: 'BRL';
    notifications?: { in_app?: boolean; email?: boolean };
  } = {};
  if (timezone.value !== saved.timezone) diff.timezone = timezone.value;
  if (currency.value !== saved.currency) diff.currency = currency.value as 'BRL';
  const notifications: { in_app?: boolean; email?: boolean } = {};
  if (inApp.value !== saved.notifications.in_app) notifications.in_app = inApp.value;
  if (email.value !== saved.notifications.email) notifications.email = email.value;
  if (Object.keys(notifications).length > 0) diff.notifications = notifications;
  return diff;
});
const dirty = computed(() => Object.keys(changes.value).length > 0);

const saving = ref(false);
const saveError = ref<string | null>(null);
const languageError = ref<string | null>(null);

async function chooseLanguage(next: string) {
  languageError.value = null;
  try {
    await preferences.changeLanguage(next as (typeof LANGUAGES)[number]);
  } catch (error) {
    languageError.value = errorMessage(error);
  }
}

async function save() {
  if (!dirty.value) return;
  saving.value = true;
  saveError.value = null;
  try {
    await preferences.saveProfile(changes.value);
    toast.success(t('profile.saved'));
  } catch (error) {
    saveError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

const ending = ref<string | null>(null);
const sessionError = ref<string | null>(null);

function deviceName(item: MySession): string {
  const { browser, system } = describeUserAgent(item.user_agent);
  const parts = [browser, system].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(', ') : t('profile.security.unknownDevice');
}

async function endSession(item: MySession) {
  ending.value = item.id;
  sessionError.value = null;
  try {
    await authApi.revokeSession(item.id);
    await sessions.refetch();
    toast.success(t('profile.security.ended'));
  } catch (error) {
    sessionError.value = errorMessage(error);
  } finally {
    ending.value = null;
  }
}

async function signOut() {
  await session.logout();
  await navigateTo('/login');
}

const displayName = computed(() => me.data.value?.name?.trim() || me.data.value?.email || '');
</script>

<template>
  <div class="stack">
    <AppState
      v-if="!ready && (me.isPending.value || profileQuery.isPending.value)"
      kind="loading"
      :title="t('profile.loading')"
    />
    <AppState
      v-else-if="!ready"
      kind="error"
      :title="t('profile.error.title')"
      :text="t('profile.error.text')"
      :action-label="t('profile.error.retry')"
      @action="retry"
    />

    <template v-else>
      <AppCard as="section" :aria-label="t('profile.identity')">
        <div class="row profile__identity">
          <span class="avatar profile__avatar" aria-hidden="true" />
          <div class="grow">
            <p class="profile__name">{{ displayName }}</p>
            <p class="muted">{{ me.data.value?.email }}</p>
            <div v-if="stores.data.value?.items.length" class="row profile__roles">
              <AppBadge
                v-for="item in stores.data.value.items"
                :key="item.id"
                :tone="item.role === 'OWNER' ? 'primary' : 'info'"
              >
                {{ t(`role.${item.role}`) }} · {{ item.name }}
              </AppBadge>
            </div>
          </div>
        </div>
      </AppCard>

      <div class="cols-2">
        <div class="stack">
          <AppCard as="section" :title="t('profile.personal.title')" body-class="stack">
            <template #head>
              <AppBadge tone="dashed">{{ t('profile.later') }}</AppBadge>
            </template>
            <div class="form-grid">
              <AppInput
                :label="t('profile.personal.name')"
                :model-value="me.data.value?.name ?? ''"
                name="name"
                autocomplete="name"
                disabled
              />
              <AppInput
                :label="t('profile.personal.email')"
                :model-value="me.data.value?.email ?? ''"
                name="email"
                autocomplete="email"
                disabled
              />
            </div>
            <p class="muted">{{ t('profile.personal.text') }}</p>
          </AppCard>

          <AppCard as="section" :title="t('profile.address.title')" body-class="stack">
            <template #head>
              <AppBadge tone="dashed">{{ t('profile.later') }}</AppBadge>
            </template>
            <p class="muted">{{ t('profile.address.text') }}</p>
          </AppCard>
        </div>

        <div class="stack">
          <form class="stack" novalidate @submit.prevent="save">
            <AppCard as="section" :title="t('profile.preferences.title')" body-class="stack">
              <AppSelect
                :label="t('profile.preferences.language')"
                :model-value="preferences.language"
                :error="languageError"
                name="language"
                @update:model-value="chooseLanguage"
              >
                <option v-for="language in LANGUAGES" :key="language" :value="language">
                  {{ t(`profile.languages.${language}`) }}
                </option>
              </AppSelect>
              <ThemeSwitcher />
              <div class="form-grid">
                <AppSelect
                  v-model="timezone"
                  :label="t('profile.preferences.timezone')"
                  name="timezone"
                >
                  <option v-for="zone in zones" :key="zone" :value="zone">{{ zone }}</option>
                </AppSelect>
                <AppSelect
                  v-model="currency"
                  :label="t('profile.preferences.currency')"
                  name="currency"
                >
                  <option value="BRL">{{ t('profile.currencies.BRL') }}</option>
                </AppSelect>
              </div>
            </AppCard>

            <AppCard as="section" :title="t('profile.notifications.title')" body-class="stack">
              <AppSwitch v-model="inApp">{{ t('profile.notifications.inApp') }}</AppSwitch>
              <AppSwitch v-model="email">{{ t('profile.notifications.email') }}</AppSwitch>
            </AppCard>

            <p v-if="saveError" role="alert" class="hint hint--error">{{ saveError }}</p>
            <div class="row profile__save">
              <AppButton type="submit" variant="primary" :busy="saving" :disabled="!dirty">
                {{ t('profile.save') }}
              </AppButton>
            </div>
          </form>

          <AppCard as="section" :title="t('profile.security.title')" body-class="stack">
            <AppDataState
              :loading="sessions.isPending.value"
              :error="sessions.isError.value"
              :empty="sessions.data.value?.items.length === 0"
              :labels="{
                loading: t('profile.security.loading'),
                emptyTitle: t('profile.security.empty'),
                errorTitle: t('profile.security.errorTitle'),
                errorText: t('profile.security.errorText'),
                retry: t('profile.error.retry'),
              }"
              @retry="sessions.refetch()"
            >
              <ul class="stack profile__sessions">
                <li v-for="item in sessions.data.value?.items" :key="item.id" class="row">
                  <span class="grow">
                    {{ deviceName(item) }}<br />
                    <span class="faint profile__small">
                      {{ t('profile.security.since', { date: format.dateTime(item.created_at) }) }}
                      <template v-if="item.ip"> · {{ item.ip }}</template>
                    </span>
                  </span>
                  <AppBadge v-if="item.current" tone="success">
                    {{ t('profile.security.current') }}
                  </AppBadge>
                  <AppButton
                    v-else
                    size="sm"
                    :busy="ending === item.id"
                    :aria-label="t('profile.security.endNamed', { device: deviceName(item) })"
                    @click="endSession(item)"
                  >
                    {{ t('profile.security.end') }}
                  </AppButton>
                </li>
              </ul>
            </AppDataState>
            <p v-if="sessionError" role="alert" class="hint hint--error">{{ sessionError }}</p>
          </AppCard>
        </div>
      </div>

      <div class="row">
        <AppButton to="/stores">{{ t('profile.changeStore') }}</AppButton>
        <AppButton variant="ghost" @click="signOut">{{ t('layout.signOut') }}</AppButton>
      </div>
    </template>
  </div>
</template>
