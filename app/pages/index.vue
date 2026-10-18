<script setup lang="ts">
const { t } = useI18n();

useHead({ title: () => t('landing.title') });
</script>

<template>
  <main id="main">
    <h1>{{ t('landing.title') }}</h1>
    <p>{{ t('landing.subtitle') }}</p>
  </main>
</template>
