<script setup lang="ts">
import dmSansLatin from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url';
import soraLatin from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url';
import { LANGUAGES } from '../utils/language';
import { landingStructuredData } from '../utils/landing';

/**
 * The landing page: static (prerendered) and indexable, in English at `/` and in Portuguese at
 * `/pt-BR/`. It follows `design/landing.html`; the pricing, showcase and dashboard sections are
 * issue #50. Whoever is already logged in has no use for it and goes into the app.
 */
const { t, locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const session = useSessionStore();
const { public: config } = useRuntimeConfig();

const STEPS = 4;
const FEATURES = 8;
const WHO = 3;
const FAQ = 7;
const CHIPS = 4;
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

const NAMES: Record<string, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

const faq = computed(() =>
  range(FAQ).map((index) => ({
    question: t(`landing.faq.items.${index}.q`),
    answer: t(`landing.faq.items.${index}.a`),
  })),
);

// The heading and the text on the first screen use these two files: asking for them early keeps the
// text from being painted twice (fallback, then the real font), which delayed the largest paint
// and moved the preview card.
const preload = [soraLatin, dmSansLatin].map(
  (href) =>
    ({
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href,
      crossorigin: 'anonymous',
    }) as const,
);

useHead({
  link: preload,
  title: () => t('landing.title'),
  meta: [{ name: 'description', content: () => t('landing.description') }],
  script: [
    {
      type: 'application/ld+json',
      // Our own text only, never data from outside: safe to serialize into the page.
      innerHTML: () =>
        JSON.stringify(
          landingStructuredData({
            siteUrl: config.siteUrl,
            locale: locale.value,
            name: t('brand.name'),
            description: t('landing.description'),
            faq: faq.value,
          }),
        ),
    },
  ],
});

// The page is prerendered for visitors (and for search engines). Whoever is already logged in is
// taken to the app, which sends them on to choose a store if needed.
onMounted(async () => {
  await session.restore();
  if (session.isAuthenticated) await navigateTo('/home', { replace: true });
});
</script>

<template>
  <div id="topo" class="landing">
    <header class="nav-top">
      <div class="wrap">
        <a class="brand" href="#topo">
          <span class="brand__mark" aria-hidden="true" />
          {{ t('brand.name') }}
        </a>
        <nav :aria-label="t('landing.nav.label')">
          <a href="#funcionalidades">{{ t('landing.nav.features') }}</a>
          <a href="#para-quem">{{ t('landing.nav.who') }}</a>
          <a href="#faq">{{ t('landing.nav.faq') }}</a>
        </nav>
        <div class="actions">
          <NuxtLink class="btn btn--ghost btn--sm" to="/login">
            {{ t('landing.nav.signIn') }}
          </NuxtLink>
          <NuxtLink class="btn btn--primary btn--sm" to="/request-access">
            {{ t('landing.nav.requestAccess') }}
          </NuxtLink>
        </div>
      </div>
    </header>

    <main id="main">
      <div class="wrap">
        <section class="hero" aria-labelledby="h1">
          <div class="stack landing__hero-text">
            <span class="pill">
              <AppIcon name="bolt" />
              {{ t('landing.hero.pill') }}
            </span>
            <h1 id="h1">
              {{ t('landing.hero.title') }}<em>{{ t('landing.hero.emphasis') }}</em>
            </h1>
            <p class="hero__lead">{{ t('landing.hero.lead') }}</p>
            <div class="row">
              <NuxtLink class="btn btn--primary btn--lg" to="/request-access">
                {{ t('landing.cta.button') }}
              </NuxtLink>
            </div>
            <div class="chips">
              <span v-for="index in range(CHIPS)" :key="index" class="badge">
                {{ t(`landing.hero.chips.${index}`) }}
              </span>
            </div>
          </div>

          <div class="card frame mock" role="img" :aria-label="t('landing.preview.label')">
            <div class="mock__bar">
              <span class="card__title">{{ t('landing.preview.title') }}</span>
              <span class="status-chip status-chip--on">{{ t('landing.preview.whatsapp') }}</span>
            </div>
            <div class="mock__row">
              <div class="mini">
                <strong>6</strong><span>{{ t('landing.preview.active') }}</span>
              </div>
              <div class="mini">
                <strong>128</strong><span>{{ t('landing.preview.bids') }}</span>
              </div>
              <div class="mini">
                <strong>9</strong><span>{{ t('landing.preview.pending') }}</span>
              </div>
            </div>
            <div class="auction__bid">
              <div class="row landing__between">
                <span class="auction__name">{{ t('landing.preview.card') }}</span>
                <span class="badge badge--success badge--live">{{
                  t('landing.preview.live')
                }}</span>
              </div>
              <strong>R$ 820,00</strong>
              <span class="mono faint landing__small">{{ t('landing.preview.bidMeta') }}</span>
            </div>
            <div class="lance">
              <span class="mono">21:42:10</span><span class="mono">(11) 9****-1020</span>
              <b>R$ 820,00</b>
            </div>
            <div class="lance">
              <span class="mono">21:41:55</span><span class="mono">(21) 9****-4455</span>
              <b>R$ 800,00</b>
            </div>
            <small class="faint landing__small">{{ t('landing.preview.example') }}</small>
          </div>
        </section>

        <section class="sec" aria-labelledby="h-como">
          <div class="sec__head">
            <span class="pill">{{ t('landing.how.pill') }}</span>
            <h2 id="h-como">{{ t('landing.how.title') }}</h2>
            <p>{{ t('landing.how.lead') }}</p>
          </div>
          <ol class="steps">
            <li v-for="index in range(STEPS)" :key="index" class="card step">
              <h3>{{ t(`landing.how.steps.${index}.title`) }}</h3>
              <p>{{ t(`landing.how.steps.${index}.text`) }}</p>
            </li>
          </ol>
        </section>

        <section id="funcionalidades" class="sec" aria-labelledby="h-func">
          <div class="sec__head">
            <span class="pill">{{ t('landing.features.pill') }}</span>
            <h2 id="h-func">{{ t('landing.features.title') }}</h2>
            <p>{{ t('landing.features.lead') }}</p>
          </div>
          <div class="feats">
            <article
              v-for="index in range(FEATURES)"
              :key="index"
              class="card card--interactive feat"
            >
              <span class="kpi__icon">
                <AppIcon :name="t(`landing.features.items.${index}.icon`)" />
              </span>
              <h3>{{ t(`landing.features.items.${index}.title`) }}</h3>
              <p>{{ t(`landing.features.items.${index}.text`) }}</p>
            </article>
          </div>
        </section>

        <section id="para-quem" class="sec" aria-labelledby="h-quem">
          <div class="sec__head">
            <span class="pill">{{ t('landing.who.pill') }}</span>
            <h2 id="h-quem">{{ t('landing.who.title') }}</h2>
          </div>
          <div class="who">
            <div v-for="index in range(WHO)" :key="index" class="card">
              <h3>{{ t(`landing.who.items.${index}.title`) }}</h3>
              <p>{{ t(`landing.who.items.${index}.text`) }}</p>
            </div>
          </div>
        </section>

        <section id="faq" class="sec landing__faq" aria-labelledby="h-faq">
          <div class="sec__head">
            <span class="pill">{{ t('landing.faq.pill') }}</span>
            <h2 id="h-faq">{{ t('landing.faq.title') }}</h2>
          </div>
          <div class="accordion">
            <details v-for="(item, index) in faq" :key="index">
              <summary>{{ item.question }}</summary>
              <p>{{ item.answer }}</p>
            </details>
          </div>
        </section>

        <section id="acesso" class="sec" aria-labelledby="h-acesso">
          <div class="card card--highlight cta">
            <div class="stack">
              <span class="pill landing__self-start">{{ t('landing.cta.pill') }}</span>
              <h2 id="h-acesso">{{ t('landing.cta.title') }}</h2>
              <p class="muted">{{ t('landing.cta.text') }}</p>
            </div>
            <div class="row landing__cta-action">
              <NuxtLink class="btn btn--primary btn--lg" to="/request-access">
                {{ t('landing.cta.button') }}
              </NuxtLink>
            </div>
          </div>
        </section>
      </div>
    </main>

    <footer class="foot">
      <div class="wrap">
        <div class="row landing__between">
          <a class="brand" href="#topo">
            <span class="brand__mark" aria-hidden="true" />
            {{ t('brand.name') }}
          </a>
          <ThemeSwitcher />
        </div>
        <nav class="foot__links" :aria-label="t('landing.footer.nav')">
          <a href="#funcionalidades">{{ t('landing.nav.features') }}</a>
          <a href="#faq">{{ t('landing.nav.faq') }}</a>
          <NuxtLink to="/request-access">{{ t('landing.nav.requestAccess') }}</NuxtLink>
          <NuxtLink to="/login">{{ t('landing.nav.signIn') }}</NuxtLink>
        </nav>
        <nav class="foot__links" :aria-label="t('landing.footer.language')">
          <a
            v-for="code in LANGUAGES"
            :key="code"
            :href="switchLocalePath(code)"
            :lang="code"
            :hreflang="code"
            :aria-current="code === locale ? 'true' : undefined"
          >
            {{ NAMES[code] }}
          </a>
        </nav>
        <p class="faint landing__note">{{ t('landing.footer.note') }}</p>
      </div>
    </footer>
  </div>
</template>
