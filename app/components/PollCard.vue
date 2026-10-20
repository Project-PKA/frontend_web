<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { createAuctionsApi, type Auction } from '../api/auctions';
import { createInventoryApi } from '../api/inventory';
import { leaderLabel } from '../utils/auctions';
import { cardTitle } from '../utils/inventory';

/**
 * One poll that reached its ceiling and waits for the store: the card, the ceiling, the highest
 * bid, who is ahead, the last bids and the decision. The bids and the photo come from the
 * auction's room and the card, so each card of the list asks for what it shows.
 */
const props = defineProps<{ auction: Auction }>();

/** How many of the last bids the card shows (the room has them all). */
const SHOWN_BIDS = 5;

const { t } = useI18n();
const access = useAccessStore();
const format = useFormat();
const api = createAuctionsApi(useApi());
const inventory = createInventoryApi(useApi());

const room = useQuery({
  queryKey: computed(() => ['auction', access.storeId, props.auction.id]),
  queryFn: ({ signal }) => api.get(props.auction.id, signal),
});
const card = useQuery({
  queryKey: computed(() => ['card', access.storeId, props.auction.card.id]),
  queryFn: ({ signal }) => inventory.get(props.auction.card.id, signal),
});

const title = computed(() => cardTitle(props.auction.card.catalog));
const photo = computed(() => card.data.value?.card.photos[0] ?? null);
const bids = computed(() => room.data.value?.bids ?? []);
const rows = computed(() =>
  bids.value.slice(0, SHOWN_BIDS).map((bid) => ({
    id: bid.id,
    time: format.time(bid.created_at),
    phone: bid.customer.phone_masked,
    amount: format.money(bid.amount),
  })),
);

const leader = computed(() => props.auction.leader);
const leaderPhone = computed(
  () => bids.value.find((bid) => bid.customer.id === leader.value?.id)?.customer.phone_masked,
);
const leaderName = computed(() => leaderLabel(leader.value, leaderPhone.value));
</script>

<template>
  <AppCard as="article" :aria-label="title">
    <template #head>
      <h2 class="card__title">
        <span class="id-chip">#{{ auction.card.short_code }}</span> {{ title }}
      </h2>
      <AppBadge tone="info">{{ t('auctions.types.POLL') }}</AppBadge>
    </template>

    <div class="stack">
      <div class="cardrow">
        <CardPhoto
          v-if="photo"
          :card-id="auction.card.id"
          :photo-id="photo"
          :alt="t('auctionRoom.photoAlt', { name: title })"
          :loading-text="t('auctionRoom.photoLoading')"
          :error-text="t('auctionRoom.photoError')"
        />
        <div v-else class="card-photo muted">{{ t('auctionRoom.noPhoto') }}</div>
        <div class="stack polls__values">
          <span class="faint polls__small">{{ t('polls.maxValue') }}</span>
          <b class="mono polls__big">
            {{ auction.max_poll_value ? format.money(auction.max_poll_value) : '' }}
          </b>
          <span class="faint polls__small">{{ t('polls.highest') }}</span>
          <b class="mono polls__highest">
            {{ auction.current_bid ? format.money(auction.current_bid) : '' }}
          </b>
        </div>
      </div>

      <div v-if="leader" class="win">
        <b>{{ t('polls.provisional') }}</b>
        <NuxtLink :to="`/customers/${leader.id}`">{{ leaderName }}</NuxtLink>
      </div>

      <div class="card polls__bids">
        <BidList
          :rows="rows"
          :label="t('auctionRoom.bids.title')"
          :empty="t('auctionRoom.bids.empty')"
        />
      </div>

      <PollDecision :auction-id="auction.id" :title="title" :winner="leaderName" />
    </div>
  </AppCard>
</template>
