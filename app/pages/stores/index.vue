<script setup lang="ts">
definePageMeta({ i18n: false, access: { level: 'session' } });

const { t } = useI18n();
useHead({ title: () => t('stores.title'), meta: [{ name: 'robots', content: 'noindex' }] });
</script>

<template>
  <main id="main">
    <h1>{{ t('stores.title') }}</h1>
  </main>
</template>
