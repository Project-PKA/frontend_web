<script setup lang="ts">
const { t } = useI18n();

useAppHead();
</script>

<template>
  <a class="skip-link" href="#main">{{ t('a11y.skipToContent') }}</a>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
