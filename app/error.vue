<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const session = useSessionStore();
const access = useAccessStore();

useAppHead();

/** Someone inside a store sees the error in the shell, with the menu; anyone else, on a plain page. */
const inShell = computed(() => session.isAuthenticated && access.storeId !== null);

// An unknown address never goes through the access middleware, so find out here who is logged in.
onMounted(async () => {
  await session.restore();
  if (!session.isAuthenticated || access.storeId === null) return;
  try {
    await access.loadStore();
  } catch {
    // The menu just stays without the store name: the error page is what matters here.
  }
});

const data = computed(
  () =>
    (props.error.data ?? {}) as { reason?: 'admin' | 'owner' | 'permission'; permission?: string },
);

const kind = computed(() => {
  if (props.error.statusCode === 403) return 'forbidden';
  if (props.error.statusCode === 404) return 'notFound';
  return 'unexpected';
});

const forbiddenMessage = computed(() => {
  if (data.value.reason === 'admin') return t('errorPage.forbidden.admin');
  if (data.value.reason === 'owner') return t('errorPage.forbidden.owner');
  if (data.value.permission) {
    return t('errorPage.forbidden.permission', {
      permission: t(`permissions.${data.value.permission}`),
    });
  }
  return t('errorPage.forbidden.generic');
});

useHead({
  title: () => t(`errorPage.${kind.value}.title`),
  meta: [{ name: 'robots', content: 'noindex' }],
});

function leave() {
  return clearError({ redirect: inShell.value ? '/home' : '/stores' });
}
</script>

<template>
  <NuxtLayout :name="inShell ? 'app' : 'public'">
    <component
      :is="inShell ? 'div' : 'main'"
      :id="inShell ? undefined : 'main'"
      :class="inShell ? undefined : 'center-page'"
    >
      <AppCard class="narrow" body-class="stack">
        <h1>{{ t(`errorPage.${kind}.title`) }}</h1>
        <p v-if="kind === 'forbidden'" class="muted">{{ forbiddenMessage }}</p>
        <p v-else class="muted">{{ t(`errorPage.${kind}.body`) }}</p>
        <AppButton @click="leave">{{ t('errorPage.back') }}</AppButton>
      </AppCard>
    </component>
  </NuxtLayout>
</template>
