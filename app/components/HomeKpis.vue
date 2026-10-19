<script setup lang="ts">
/**
 * The five live indicators. This is also where the home says it could not load: the other
 * pieces ask the same thing, so one message (and one "try again") is enough.
 */
const { t } = useI18n();
const access = useAccessStore();
const kpis = useHomeData((home) => home.kpis);
</script>

<template>
  <AppState v-if="kpis.isPending.value" kind="loading" :title="t('home.loading')" />
  <AppState
    v-else-if="!kpis.data.value"
    kind="error"
    :title="t('home.error.title')"
    :text="t('home.error.text')"
    :action-label="t('home.error.retry')"
    @action="kpis.refetch()"
  />
  <div v-else class="grid grid--kpi5" role="group" :aria-label="t('home.kpis.label')">
    <AppKpi icon="bolt" :value="kpis.data.value.active_auctions" :label="t('home.kpis.active')">
      <template #badge>
        <AppBadge tone="success" live>{{ t('home.kpis.live') }}</AppBadge>
      </template>
      <template v-if="access.can('can_manage_auctions')" #link>
        <NuxtLink class="home__kpi-link" to="/auctions">{{ t('home.kpis.openMonitor') }}</NuxtLink>
      </template>
    </AppKpi>
    <AppKpi
      icon="clock"
      :value="kpis.data.value.scheduled_today"
      :label="t('home.kpis.scheduled')"
    />
    <AppKpi icon="message" :value="kpis.data.value.bids_in_active" :label="t('home.kpis.bids')" />
    <AppKpi
      icon="wallet"
      :value="kpis.data.value.pending_settlements"
      :label="t('home.kpis.settlements')"
    >
      <template v-if="kpis.data.value.pending_settlements > 0" #badge>
        <AppBadge tone="warning">{{ t('home.kpis.attention') }}</AppBadge>
      </template>
      <template v-if="kpis.data.value.pending_settlements > 0" #link>
        <a class="home__kpi-link" href="#settlements">{{ t('home.kpis.goToQueue') }}</a>
      </template>
    </AppKpi>
    <AppKpi
      icon="box"
      :value="kpis.data.value.cards_without_auction"
      :label="t('home.kpis.noAuction')"
    >
      <template v-if="kpis.data.value.cards_without_auction > 0" #badge>
        <AppBadge tone="primary">{{ t('home.kpis.reminder') }}</AppBadge>
      </template>
      <template v-if="kpis.data.value.cards_without_auction > 0" #link>
        <a class="home__kpi-link" href="#no-auction">{{ t('home.kpis.seeCards') }}</a>
      </template>
    </AppKpi>
  </div>
</template>
