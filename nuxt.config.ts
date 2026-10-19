// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxtjs/i18n', '@pinia/nuxt'],
  css: [
    '@fontsource-variable/sora',
    '@fontsource-variable/dm-sans',
    '@fontsource-variable/jetbrains-mono',
  ],
  i18n: {
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'pt-BR', language: 'pt-BR', name: 'Português (Brasil)', file: 'pt-BR.json' },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    // Absolute origin for canonical and hreflang links; set at build time per environment.
    baseUrl: process.env.SITE_URL ?? '',
  },
  nitro: {
    prerender: { routes: ['/', '/pt-BR'] },
  },
});
