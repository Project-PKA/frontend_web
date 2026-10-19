// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxtjs/i18n', '@pinia/nuxt'],
  css: [
    '@fontsource-variable/sora',
    '@fontsource-variable/dm-sans',
    '@fontsource-variable/jetbrains-mono',
    '~/assets/css/tokens.css',
    '~/assets/css/fonts.css',
    '~/assets/css/components.css',
    '~/assets/css/app.css',
  ],
  i18n: {
    locales: [
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
      { code: 'pt-BR', language: 'pt-BR', name: 'Português (Brasil)', file: 'pt-BR.json' },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    // Only the public pages (landing, terms, privacy) have /pt-BR URLs. App pages opt out
    // with definePageMeta({ i18n: false }) and get their language from the person.
    customRoutes: 'meta',
    detectBrowserLanguage: false,
    // Absolute origin for canonical and hreflang links; set at build time per environment.
    baseUrl: process.env.SITE_URL ?? '',
  },
  runtimeConfig: {
    public: {
      // Origin of the API. Resolved at build time (NUXT_PUBLIC_API_BASE_URL).
      apiBaseUrl: 'http://localhost:8080',
    },
  },
  // The logged-in app is a client-only SPA (STACK.md section 1).
  routeRules: {
    '/invite': { ssr: false },
    '/convite': { ssr: false },
    '/stores/**': { ssr: false },
    '/home': { ssr: false },
    '/activity': { ssr: false },
  },
  nitro: {
    prerender: {
      routes: ['/', '/pt-BR'],
    },
  },
});
