<script setup lang="ts">
definePageMeta({ layout: 'public' });

const SECTIONS = 7;

const { t } = useI18n();
const localePath = useLocalePath();

useHead({ title: () => t('legal.privacy.title') });

const sections = computed(() =>
  Array.from({ length: SECTIONS }, (_, index) => ({
    title: t(`legal.privacy.sections.${index}.title`),
    text: t(`legal.privacy.sections.${index}.text`),
  })),
);
</script>

<template>
  <LegalDocument
    :title="t('legal.privacy.title')"
    :notice="t('legal.notice')"
    :sections="sections"
    :other="{ label: t('legal.terms.title'), to: localePath('/terms') }"
  />
</template>
