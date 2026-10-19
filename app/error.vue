<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();

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
  return clearError({ redirect: '/stores' });
}
</script>

<template>
  <main id="main" class="center-page">
    <section class="card narrow">
      <div class="card__body stack">
        <h1>{{ t(`errorPage.${kind}.title`) }}</h1>
        <p v-if="kind === 'forbidden'" class="muted">{{ forbiddenMessage }}</p>
        <p v-else class="muted">{{ t(`errorPage.${kind}.body`) }}</p>
        <button class="btn btn--secondary" type="button" @click="leave">
          {{ t('errorPage.back') }}
        </button>
      </div>
    </section>
  </main>
</template>
