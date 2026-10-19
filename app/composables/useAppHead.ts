/**
 * Page-wide head tags: the `lang` and `dir` of the document, and the canonical and
 * hreflang links. Used by `app.vue` and by `error.vue`, which replaces the app when
 * an error is shown (an error page without `lang` fails accessibility checks).
 */
export function useAppHead() {
  const localeHead = useLocaleHead({ dir: true, lang: true, seo: true });

  useHead({
    htmlAttrs: {
      lang: () => localeHead.value.htmlAttrs?.lang,
      dir: () => localeHead.value.htmlAttrs?.dir,
    },
    // Canonical and hreflang must be absolute URLs: skip them when SITE_URL was not set at build time.
    link: () =>
      (localeHead.value.link ?? []).filter((link) => /^https?:\/\//.test(link.href ?? '')),
    meta: () =>
      (localeHead.value.meta ?? []).filter(
        (meta) => !(typeof meta.content === 'string' && meta.content.startsWith('/')),
      ),
  });
}
