<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { createAuctionsApi, type AuctionStatus } from '../../../api/auctions';
import { createInventoryApi } from '../../../api/inventory';
import { editMode, leaderLabel } from '../../../utils/auctions';
import { cardTitle, statusTone } from '../../../utils/inventory';
import { formatCountdown } from '../../../utils/format';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'auctionRoom.title',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

/** A running auction is a live monitor: the bids come in, so it asks again every few seconds. */
const LIVE_REFRESH_MS = 5_000;
/** A scheduled one only has to notice when it starts. */
const SCHEDULED_REFRESH_MS = 15_000;
/** The ways to push the end later, in minutes. */
const EXTENSIONS = [15, 30, 60] as const;

const { t } = useI18n();
const route = useRoute();
const access = useAccessStore();
const errorMessage = useErrorMessage();
const toast = useToast();
const format = useFormat();
const queryClient = useQueryClient();
const api = createAuctionsApi(useApi());
const inventory = createInventoryApi(useApi());
const now = useNow();

const id = computed(() => String(route.params.id));
const room = useQuery({
  queryKey: computed(() => ['auction', access.storeId, id.value]),
  queryFn: ({ signal }) => api.get(id.value, signal),
  refetchInterval: (query) => {
    const status: AuctionStatus | undefined = query.state.data?.auction.status;
    if (status === 'ACTIVE' || status === 'PAUSED_FOR_VALIDATION') return LIVE_REFRESH_MS;
    return status === 'PENDING' ? SCHEDULED_REFRESH_MS : false;
  },
});
const auction = computed(() => room.data.value?.auction);
const bids = computed(() => room.data.value?.bids ?? []);

// The real photo and the origin come from the card itself.
const card = useQuery({
  queryKey: computed(() => ['card', access.storeId, auction.value?.card.id]),
  queryFn: ({ signal }) => inventory.get(auction.value?.card.id ?? '', signal),
  enabled: computed(() => !!auction.value),
});
const firstPhoto = computed(() => card.data.value?.card.photos[0] ?? null);

const title = computed(() => (auction.value ? cardTitle(auction.value.card.catalog) : ''));
const running = computed(
  () => auction.value?.status === 'ACTIVE' || auction.value?.status === 'PAUSED_FOR_VALIDATION',
);
const remaining = computed(() =>
  auction.value ? formatCountdown(new Date(auction.value.end_time).getTime() - now.value) : '',
);

const bidRows = computed(() =>
  bids.value.map((bid) => ({
    id: bid.id,
    time: format.time(bid.created_at),
    phone: bid.customer.phone_masked,
    amount: format.money(bid.amount),
  })),
);
const lastBid = computed(() => {
  const latest = [...bids.value].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest ? format.relative(latest.created_at, now.value) : null;
});

/** The winner's phone, from the bids (the auction only carries the id and the name). */
const winnerPhone = computed(
  () =>
    bids.value.find((bid) => bid.customer.id === auction.value?.leader?.id)?.customer.phone_masked,
);

const statusLabel = computed(() =>
  auction.value ? t(`auctions.status.${auction.value.status}`) : '',
);

// ---- Extending the end
const extending = ref<number | null>(null);
const extendError = ref<string | null>(null);

async function extend(minutes: number) {
  extending.value = minutes;
  extendError.value = null;
  try {
    await api.extend(id.value, minutes);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['auction'] }),
      queryClient.invalidateQueries({ queryKey: ['auctions'] }),
    ]);
    toast.success(t('auctionRoom.extended', { minutes }));
  } catch (error) {
    extendError.value = errorMessage(error);
  } finally {
    extending.value = null;
  }
}

const extensionLabel = (minutes: number) =>
  minutes < 60 ? t('auctionRoom.extend.minutes', { n: minutes }) : t('auctionRoom.extend.hour');
</script>

<template>
  <div class="stack">
    <AppState v-if="room.isPending.value" kind="loading" :title="t('auctionRoom.loading')" />
    <AppState
      v-else-if="!auction"
      kind="error"
      :title="t('auctionRoom.error.title')"
      :text="errorMessage(room.error.value)"
      :action-label="t('auctionRoom.error.retry')"
      @action="room.refetch()"
    />

    <template v-else>
      <div class="crumb">
        <NuxtLink to="/auctions">{{ t('auctions.title') }}</NuxtLink> /
        <span class="id-chip">#{{ auction.card.short_code }}</span>
      </div>

      <div class="page-head">
        <h2>{{ title }}</h2>
        <div v-if="editMode(auction.status) !== 'none'" class="row">
          <AppButton :to="`/auctions/${auction.id}/edit`">
            <AppIcon name="edit" />
            {{ t('auctionRoom.edit') }}
          </AppButton>
        </div>
      </div>

      <div class="cols-2">
        <AppCard as="section" :title="t('auctionRoom.card')" :aria-label="t('auctionRoom.card')">
          <div class="cardrow">
            <CardPhoto
              v-if="firstPhoto"
              :card-id="auction.card.id"
              :photo-id="firstPhoto"
              :alt="t('auctionRoom.photoAlt', { name: title })"
              :loading-text="t('auctionRoom.photoLoading')"
              :error-text="t('auctionRoom.photoError')"
            />
            <div v-else class="card-photo muted">{{ t('auctionRoom.noPhoto') }}</div>

            <div class="stack auctionroom__info">
              <div class="row">
                <AppBadge
                  :tone="
                    auction.status === 'ACTIVE'
                      ? 'success'
                      : auction.status === 'PAUSED_FOR_VALIDATION'
                        ? 'warning'
                        : statusTone('AVAILABLE')
                  "
                  :live="auction.status === 'ACTIVE'"
                >
                  {{ statusLabel }}
                </AppBadge>
                <AppBadge :tone="auction.type === 'POLL' ? 'info' : undefined">
                  {{ t(`auctions.types.${auction.type}`) }}
                </AppBadge>
                <span class="id-chip">#{{ auction.card.short_code }}</span>
              </div>

              <!-- Running or scheduled: the highest bid. Finished: who won. -->
              <div v-if="auction.status === 'FINISHED' && auction.leader" class="win">
                <b>{{ t('auctionRoom.winner') }}</b>
                <NuxtLink :to="`/customers/${auction.leader.id}`">
                  {{ auction.leader.name
                  }}<template v-if="winnerPhone"> · {{ winnerPhone }}</template>
                </NuxtLink>
                <br />
                <span class="mono">{{
                  auction.current_bid ? format.money(auction.current_bid) : ''
                }}</span>
                · {{ t('auctionRoom.bidCount', { count: auction.bid_count }, auction.bid_count) }}
              </div>
              <p v-else-if="auction.status === 'FINISHED'" class="muted">
                {{ t('auctions.noWinner') }}
              </p>
              <div v-else-if="auction.status !== 'CANCELLED'" class="auction__bid">
                <span class="faint auctionroom__small">{{ t('auctionRoom.highest') }}</span>
                <strong>
                  {{
                    auction.current_bid
                      ? format.money(auction.current_bid)
                      : t('auctionRoom.noBids')
                  }}
                </strong>
                <span class="mono faint auctionroom__small">
                  {{ t('auctionRoom.bidCount', { count: auction.bid_count }, auction.bid_count) }}
                  <template v-if="lastBid">
                    · {{ t('auctionRoom.lastBid', { ago: lastBid }) }}</template
                  >
                </span>
              </div>

              <p v-if="running" class="mono auctionroom__clock" role="timer" aria-live="off">
                {{ t('auctionRoom.endsIn', { time: remaining }) }}
              </p>
              <p v-else-if="auction.status === 'PENDING'" class="mono">
                {{ t('auctionRoom.startsAt', { date: format.dateTime(auction.start_time) }) }}
              </p>
              <p v-else class="mono muted">
                {{ t('auctionRoom.endedAt', { date: format.dateTime(auction.end_time) }) }}
              </p>

              <div v-if="auction.status === 'PAUSED_FOR_VALIDATION'" class="alert alert--warning">
                <AppIcon name="alert" />
                <div class="alert__body">
                  <p class="alert__title">{{ t('auctionRoom.paused.title') }}</p>
                  <span class="muted">{{ t('auctionRoom.paused.text') }}</span>
                  <PollDecision
                    :auction-id="auction.id"
                    :title="title"
                    :winner="leaderLabel(auction.leader, winnerPhone)"
                  />
                </div>
              </div>

              <div v-if="running" class="stack">
                <span class="label">{{ t('auctionRoom.extend.label') }}</span>
                <div class="row">
                  <AppButton
                    v-for="minutes in EXTENSIONS"
                    :key="minutes"
                    size="sm"
                    :busy="extending === minutes"
                    :disabled="extending !== null"
                    @click="extend(minutes)"
                  >
                    {{ extensionLabel(minutes) }}
                  </AppButton>
                </div>
                <p v-if="extendError" role="alert" class="hint hint--error">{{ extendError }}</p>
              </div>

              <dl class="kv">
                <dt>{{ t('inventory.columns.set') }}</dt>
                <dd>{{ auction.card.catalog.set_name }} · {{ auction.card.catalog.number }}</dd>
                <dt>{{ t('inventory.columns.condition') }}</dt>
                <dd>{{ auction.card.condition }} · {{ auction.card.language.toUpperCase() }}</dd>
                <template v-if="card.data.value">
                  <dt>{{ t('inventory.columns.origin') }}</dt>
                  <dd>{{ t(`inventory.origin.${card.data.value.card.origin}`) }}</dd>
                </template>
                <dt>{{ t('auctionRoom.initial') }}</dt>
                <dd class="mono">{{ format.money(auction.initial_bid) }}</dd>
                <dt>{{ t('auctionRoom.increment') }}</dt>
                <dd class="mono">{{ format.money(auction.min_increment) }}</dd>
                <template v-if="auction.type === 'POLL' && auction.max_poll_value">
                  <dt>{{ t('auctionRoom.ceiling') }}</dt>
                  <dd class="mono">{{ format.money(auction.max_poll_value) }}</dd>
                </template>
              </dl>
            </div>
          </div>
        </AppCard>

        <AppCard
          as="section"
          :title="t('auctionRoom.bids.title')"
          :aria-label="t('auctionRoom.bids.title')"
        >
          <BidList
            :rows="bidRows"
            :label="t('auctionRoom.bids.title')"
            :empty="t('auctionRoom.bids.empty')"
          />
          <template #foot>
            {{ t(running ? 'auctionRoom.bids.footLive' : 'auctionRoom.bids.foot') }}
          </template>
        </AppCard>
      </div>
    </template>
  </div>
</template>
