<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query';
import {
  SHOWCASE_MAX_OFFSET,
  SHOWCASE_PAGE,
  createPublicPagesApi,
  type ShowcaseSort,
} from '../api/public-pages';
import { artUrl } from '../utils/catalog';
import { formatCountdown } from '../utils/format';
import { normalizeShowcase } from '../utils/public-pages';
import { isGroupInviteUrl } from '../utils/settings';

definePageMeta({ i18n: false, layout: 'public' });

/** The page is "live": it asks again while it is open. */
const REFRESH_MS = 30_000;
const SORTS: readonly ShowcaseSort[] = ['ENDING_SOON', 'HIGHEST_BID', 'MOST_BIDS', 'NEWEST'];
/** The languages of the cards, as the inventory keeps them. */
const LANGUAGES = ['PT', 'EN', 'JP', 'ES'] as const;

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();
const format = useFormat();
const now = useNow();
const api = createPublicPagesApi(usePublicApi());

useHead({
  title: () => t('showcase.title'),
  meta: [{ name: 'description', content: () => t('showcase.lead') }],
});

// The filters live in the address (`/showcase?sort=HIGHEST_BID`): a link to a view can be shared.
function one(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : '';
}
const store = ref(one(route.query.store));
const language = ref(
  (LANGUAGES as readonly string[]).includes(one(route.query.language))
    ? one(route.query.language)
    : '',
);
const sort = ref<ShowcaseSort>(
  (SORTS as readonly string[]).includes(one(route.query.sort))
    ? (one(route.query.sort) as ShowcaseSort)
    : 'ENDING_SOON',
);

const address = computed(() => ({
  ...(store.value ? { store: store.value } : {}),
  ...(language.value ? { language: language.value } : {}),
  ...(sort.value !== 'ENDING_SOON' ? { sort: sort.value } : {}),
}));
watch(address, (next) => void router.replace({ query: next }));

const list = useInfiniteQuery(() => ({
  queryKey: ['public-showcase', store.value, language.value, sort.value],
  queryFn: async ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
    normalizeShowcase(
      await api.showcase(
        {
          ...(store.value ? { store: store.value } : {}),
          ...(language.value ? { language: language.value } : {}),
          sort: sort.value,
        },
        pageParam,
        signal,
      ),
    ),
  initialPageParam: 0,
  getNextPageParam: (last: { items: unknown[] }, pages: unknown[]) => {
    const next = pages.length * SHOWCASE_PAGE;
    return last.items.length < SHOWCASE_PAGE || next > SHOWCASE_MAX_OFFSET ? undefined : next;
  },
  refetchInterval: REFRESH_MS,
  retry: false,
}));

const pages = computed(() => list.data.value?.pages ?? []);
const items = computed(() => pages.value.flatMap((page) => page.items));
const total = computed(() => pages.value[0]?.total ?? 0);
const stores = computed(() => pages.value[0]?.stores ?? []);

const cards = computed(() =>
  items.value.map((item) => ({
    ...item,
    art: artUrl(item.imageUrl),
    meta: [item.set, item.condition, item.language].filter(Boolean).join(' · '),
    left: item.endsAt ? formatCountdown(new Date(item.endsAt).getTime() - now.value) : '',
    last: item.lastBidAt ? format.relative(item.lastBidAt) : '',
    // The way to bid is the group of the store: only a real invitation link is offered.
    group: item.groupUrl && isGroupInviteUrl(item.groupUrl) ? item.groupUrl : null,
  })),
);

const languageName = (code: string) =>
  te(`inventory.languages.${code}`) ? t(`inventory.languages.${code}`) : code;
</script>

<template>
  <main id="main">
    <div class="wrap showcase">
      <div class="stack showcase__head">
        <div class="row">
          <h1>{{ t('showcase.heading') }}</h1>
          <AppBadge v-if="total > 0" tone="success" live>
            {{ t('showcase.count', { count: total }, total) }}
          </AppBadge>
        </div>
        <p class="muted">{{ t('showcase.lead') }}</p>
      </div>

      <div class="filters" role="search">
        <select v-model="store" class="select" :aria-label="t('showcase.filters.store')">
          <option value="">{{ t('showcase.filters.storeAll') }}</option>
          <option v-for="item in stores" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <select v-model="language" class="select" :aria-label="t('showcase.filters.language')">
          <option value="">{{ t('showcase.filters.languageAll') }}</option>
          <option v-for="code in LANGUAGES" :key="code" :value="code">
            {{ languageName(code) }}
          </option>
        </select>
        <select v-model="sort" class="select" :aria-label="t('showcase.filters.sort')">
          <option v-for="item in SORTS" :key="item" :value="item">
            {{ t(`showcase.sort.${item}`) }}
          </option>
        </select>
      </div>

      <AppState v-if="list.isPending.value" kind="loading" :title="t('showcase.loading')" />
      <AppState
        v-else-if="list.isError.value"
        kind="error"
        :title="t('showcase.error.title')"
        :text="t('showcase.error.text')"
        :action-label="t('showcase.error.retry')"
        @action="list.refetch()"
      />
      <AppState
        v-else-if="cards.length === 0"
        kind="empty"
        :title="t('showcase.empty.title')"
        :text="t('showcase.empty.text')"
      />

      <template v-else>
        <div class="market">
          <article v-for="card in cards" :key="card.key" class="card card--interactive auction">
            <div class="auction__top">
              <span class="badge">{{ card.storeName }}</span>
              <span class="badge badge--success badge--live">{{ t('showcase.live') }}</span>
            </div>
            <div class="tcg">
              <img
                v-if="card.art"
                class="showcase__art"
                :src="card.art"
                :alt="card.name"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <div v-else class="tcg__ph">{{ t('showcase.noPhoto') }}</div>
            </div>
            <div>
              <h2 class="auction__name">{{ card.name }} {{ card.number }}</h2>
              <div class="faint showcase__meta">{{ card.meta }}</div>
            </div>
            <div class="auction__bid">
              <span class="faint showcase__meta">{{ t('showcase.highest') }}</span>
              <strong>{{
                card.currentBid ? format.money(card.currentBid) : t('showcase.noBids')
              }}</strong>
              <span class="mono faint showcase__meta">
                {{ t('showcase.bids', { count: card.bidCount }, card.bidCount) }}
                <template v-if="card.last">
                  · {{ t('showcase.last', { when: card.last }) }}</template
                >
              </span>
            </div>
            <div v-if="card.left" class="mono muted showcase__meta" role="timer" aria-live="off">
              {{ t('showcase.endsIn', { time: card.left }) }}
            </div>
            <a
              v-if="card.group"
              class="btn btn--primary btn--block"
              :href="card.group"
              target="_blank"
              rel="noopener noreferrer"
              :title="t('showcase.openGroup')"
            >
              {{ t('showcase.go') }}
              <AppIcon name="external" />
            </a>
          </article>
        </div>

        <div v-if="list.hasNextPage.value" class="row showcase__more">
          <AppButton :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
            {{ t('showcase.loadMore') }}
          </AppButton>
        </div>
      </template>
    </div>
  </main>
</template>
