<script setup lang="ts">
definePageMeta({ layout: 'public' });

const SECTIONS = 6;

const { t } = useI18n();
const localePath = useLocalePath();

useHead({ title: () => t('legal.terms.title') });

const sections = computed(() =>
  Array.from({ length: SECTIONS }, (_, index) => ({
    title: t(`legal.terms.sections.${index}.title`),
    text: t(`legal.terms.sections.${index}.text`),
  })),
);
</script>

<template>
  <LegalDocument
    :title="t('legal.terms.title')"
    :notice="t('legal.notice')"
    :sections="sections"
    :other="{ label: t('legal.privacy.title'), to: localePath('/privacy') }"
  />
</template>
