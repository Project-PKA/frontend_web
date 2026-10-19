<script setup lang="ts">
const { t } = useI18n();
const localeHead = useLocaleHead({ dir: true, lang: true, seo: true });

useHead({
  htmlAttrs: {
    lang: () => localeHead.value.htmlAttrs?.lang,
    dir: () => localeHead.value.htmlAttrs?.dir,
  },
  // Canonical and hreflang must be absolute URLs: skip them when SITE_URL was not set at build time.
  link: () => (localeHead.value.link ?? []).filter((link) => /^https?:\/\//.test(link.href ?? '')),
  meta: () =>
    (localeHead.value.meta ?? []).filter(
      (meta) => !(typeof meta.content === 'string' && meta.content.startsWith('/')),
    ),
});
</script>

<template>
  <a class="skip-link" href="#main">{{ t('a11y.skipToContent') }}</a>
  <NuxtPage />
</template>

<style>
.skip-link {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  padding: 0.5rem 1rem;
  background: Canvas;
  color: CanvasText;
  transform: translateY(-120%);
}

.skip-link:focus {
  transform: none;
}
</style>
