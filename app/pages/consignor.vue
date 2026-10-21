<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createPublicPagesApi } from '../api/public-pages';
import { ApiError } from '../api/errors';
import { formatCountdown } from '../utils/format';
import { tokenFromFragment } from '../utils/fragment-token';
import { accessKey, commissionOf, normalizeConsignor } from '../utils/public-pages';

definePageMeta({ i18n: false, layout: 'plain' });

/** The page follows the auctions of the cards: it asks again while it is open. */
const REFRESH_MS = 15_000;

const { t, te } = useI18n();
const route = useRoute();
const format = useFormat();
const now = useNow();
const api = createPublicPagesApi(usePublicApi());

// The token is in the fragment (never in the path or the query), so it does not reach a log.
useHead({
  title: () => t('consignorPage.title'),
  meta: [
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'no-referrer' },
  ],
});

const token = computed(() => tokenFromFragment(route.hash));

// ---- The gate: the 4 first digits of the CPF. The key lives in memory only.
const typed = ref('');
const key = ref<string | null>(null);

const page = useQuery({
  queryKey: ['public-consignor', token, key],
  queryFn: async () =>
    normalizeConsignor(await api.consignor(token.value as string, key.value as string)),
  enabled: computed(() => token.value !== null && key.value !== null),
  retry: false,
  refetchInterval: REFRESH_MS,
  staleTime: 0,
});

const view = computed(() => page.data.value ?? null);
const status = computed(() => (page.error.value instanceof ApiError ? page.error.value : null));
/** A link that does not work and a wrong key answer the same, so the page says the same. */
const refused = computed(() => status.value?.status === 404);
const blocked = computed(() => status.value?.status === 429);
const failed = computed(() => page.isError.value && !refused.value && !blocked.value);
const checking = computed(() => key.value !== null && page.isPending.value);

function open() {
  const digits = accessKey(typed.value);
  if (digits === null) return;
  // The same key again asks again: the answer may be different now.
  if (key.value === digits) void page.refetch();
  key.value = digits;
}

function retry() {
  key.value = null;
  typed.value = '';
}

const optionName = (prefix: string, value: string) =>
  te(`${prefix}.${value}`) ? t(`${prefix}.${value}`) : value;
const cardStatus = (value: string) => optionName('inventory.status', value);
const auctionStatus = (value: string) => optionName('auctions.status', value);

const cards = computed(() =>
  (view.value?.cards ?? []).map((card) => {
    const auction = card.auction;
    const left =
      auction?.endsAt && auction.status === 'ACTIVE'
        ? formatCountdown(new Date(auction.endsAt).getTime() - now.value)
        : null;
    return {
      ...card,
      meta: [card.number, card.condition, card.language].filter(Boolean).join(' · '),
      live: auction?.status === 'ACTIVE',
      left,
      bids: (auction?.bids ?? []).map((bid, index) => ({
        id: `${card.code}-${index}`,
        time: format.time(bid.at),
        phone: bid.phone,
        amount: format.money(bid.amount),
      })),
      commission:
        auction?.currentBid && auction.estimatedPayout
          ? commissionOf(auction.currentBid, auction.estimatedPayout)
          : null,
    };
  }),
);
</script>

<template>
  <main id="main" class="wrap consignor">
    <div v-if="token === null" class="center-page">
      <AppCard class="narrow" body-class="stack">
        <h1>{{ t('consignorPage.invalid.title') }}</h1>
        <p class="muted">{{ t('consignorPage.invalid.text') }}</p>
      </AppCard>
    </div>

    <div v-else-if="!view" class="center-page">
      <AppState v-if="checking" kind="loading" :title="t('consignorPage.loading')" />
      <AppCard v-else class="narrow" highlight body-class="stack">
        <span class="brand__mark consignor__mark" aria-hidden="true" />
        <div>
          <h1>{{ t('consignorPage.gate.title') }}</h1>
          <p class="muted">{{ t('consignorPage.gate.text') }}</p>
        </div>
        <form class="stack" novalidate @submit.prevent="open">
          <AppOtpInput
            v-model="typed"
            keys
            :length="4"
            :label="t('consignorPage.gate.label')"
            :digit-label="
              (position: number, total: number) =>
                t('consignorPage.gate.digit', { position, total })
            "
            :invalid="refused || blocked"
            @complete="open"
          />
          <p v-if="refused" role="alert" class="hint hint--error">
            {{ t('consignorPage.gate.refused') }}
          </p>
          <p v-if="blocked" role="alert" class="hint hint--error">
            {{ t('consignorPage.gate.blocked') }}
          </p>
          <p v-if="failed" role="alert" class="hint hint--error">
            {{ t('consignorPage.gate.failed') }}
          </p>
          <AppButton
            type="submit"
            variant="primary"
            size="lg"
            block
            :disabled="accessKey(typed) === null"
          >
            {{ t('consignorPage.gate.submit') }}
          </AppButton>
          <p v-if="refused || blocked || failed" class="faint consignor__meta">
            <AppButton size="sm" variant="ghost" @click="retry">{{
              t('consignorPage.gate.again')
            }}</AppButton>
          </p>
          <p class="faint consignor__meta">{{ t('consignorPage.gate.note') }}</p>
        </form>
      </AppCard>
    </div>

    <div v-else class="narrow-lg stack consignor__page">
      <div class="stack consignor__head">
        <h1>
          {{ t('consignorPage.heading', { name: view.firstName || '—', store: view.storeName }) }}
        </h1>
        <p class="muted">{{ t('consignorPage.intro') }}</p>
      </div>

      <AppCard v-if="cards.length === 0" body-class="stack">
        <p class="muted">{{ t('consignorPage.empty') }}</p>
      </AppCard>

      <template v-else>
        <section
          v-for="card in cards"
          :key="card.code"
          class="stack consignor__card"
          :aria-label="`#${card.code} ${card.name}`"
        >
          <div class="stack consignor__head">
            <div class="row">
              <h2>{{ card.name }}</h2>
              <span class="id-chip">#{{ card.code }}</span>
              <AppBadge :tone="card.live ? 'success' : 'info'">
                {{ card.auction ? auctionStatus(card.auction.status) : cardStatus(card.status) }}
              </AppBadge>
            </div>
            <p v-if="card.meta" class="muted">
              {{ card.meta }} · {{ t('consignorPage.consignedByYou') }}
            </p>
          </div>

          <div v-if="card.auction" class="cols-2">
            <AppCard as="section" :aria-label="t('consignorPage.auction.title')">
              <div class="card__body stack">
                <div class="auction__bid">
                  <span class="faint consignor__meta">{{
                    t('consignorPage.auction.highest')
                  }}</span>
                  <strong>{{
                    card.auction.currentBid ? format.money(card.auction.currentBid) : '—'
                  }}</strong>
                  <span class="mono faint consignor__meta">
                    {{
                      t(
                        'consignorPage.auction.bidCount',
                        { count: card.auction.bidCount },
                        card.auction.bidCount,
                      )
                    }}
                  </span>
                </div>
                <div v-if="card.left" class="mono" role="timer" aria-live="off">
                  {{ t('consignorPage.auction.endsIn', { time: card.left }) }}
                </div>
              </div>
            </AppCard>
            <AppCard as="section" :aria-label="t('consignorPage.bids.title')">
              <div class="card__head">
                <h3 class="card__title">{{ t('consignorPage.bids.title') }}</h3>
              </div>
              <BidList
                :rows="card.bids"
                :label="t('consignorPage.bids.title')"
                :empty="t('consignorPage.bids.empty')"
              />
              <div class="card__foot">{{ t('consignorPage.bids.note') }}</div>
            </AppCard>
          </div>

          <AppCard
            v-if="card.auction?.estimatedPayout"
            as="section"
            :aria-label="t('consignorPage.estimate.title')"
          >
            <div class="card__head">
              <h3 class="card__title">{{ t('consignorPage.estimate.title') }}</h3>
            </div>
            <div class="card__body stack">
              <div class="row consignor__line">
                <span>{{ t('consignorPage.estimate.bid') }}</span>
                <span class="mono">{{ format.money(card.auction.currentBid ?? '0.00') }}</span>
              </div>
              <div v-if="card.commission" class="row consignor__line">
                <span>{{
                  t('consignorPage.estimate.commission', { pct: card.commissionPct })
                }}</span>
                <span class="mono">− {{ format.money(card.commission) }}</span>
              </div>
              <div class="row consignor__line">
                <b>{{
                  view.estimateIsFinal
                    ? t('consignorPage.estimate.final')
                    : t('consignorPage.estimate.net')
                }}</b>
                <b class="mono consignor__net">{{ format.money(card.auction.estimatedPayout) }}</b>
              </div>
              <p class="faint consignor__meta">{{ t('consignorPage.estimate.note') }}</p>
            </div>
          </AppCard>
        </section>
      </template>
    </div>
  </main>
</template>
