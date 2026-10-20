<script setup lang="ts">
const { t } = useI18n();
const session = useSessionStore();

useHead({
  title: () => t('landing.title'),
  meta: [{ name: 'description', content: () => t('landing.description') }],
});

// The page is prerendered for visitors (and for search engines). Whoever is already logged in has
// no use for it: `/` takes them to the app, which sends them on to choose a store if needed.
onMounted(async () => {
  await session.restore();
  if (session.isAuthenticated) await navigateTo('/home', { replace: true });
});
</script>

<template>
  <main id="main">
    <h1>{{ t('landing.title') }}</h1>
    <p>{{ t('landing.subtitle') }}</p>
  </main>
</template>
