<script setup lang="ts">
import { createAuctionsApi } from '../../api/auctions';
import { useCursorList } from '../../utils/cursor-list';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'polls.title',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

/** The polls that wait for the store are asked again by themselves: one may have just arrived. */
const REFRESH_MS = 15_000;

const { t } = useI18n();
const access = useAccessStore();
const api = createAuctionsApi(useApi());

const list = useCursorList({
  queryKey: () => ['auctions', access.storeId, 'paused'],
  fetchPage: (cursor, signal) => api.list('PAUSED_FOR_VALIDATION', cursor, signal),
  refetchInterval: REFRESH_MS,
});
</script>

<template>
  <div class="stack">
    <div class="crumb">
      <NuxtLink to="/auctions">{{ t('auctions.title') }}</NuxtLink> / {{ t('polls.crumb') }}
    </div>

    <AppDataState
      :loading="list.isLoading.value"
      :error="list.isError.value"
      :empty="list.items.value.length === 0"
      :labels="{
        loading: t('polls.loading'),
        emptyTitle: t('polls.empty.title'),
        emptyText: t('polls.empty.text'),
        errorTitle: t('polls.error.title'),
        errorText: t('polls.error.text'),
        retry: t('polls.error.retry'),
      }"
      @retry="list.refetch()"
    >
      <div class="alert alert--warning" role="status">
        <AppIcon name="alert" />
        <div class="alert__body">
          <p class="alert__title">
            {{ t('polls.pending', { count: list.items.value.length }, list.items.value.length) }}
          </p>
          <span class="muted">{{ t('polls.pendingText') }}</span>
        </div>
      </div>

      <div class="cols-2">
        <PollCard v-for="auction in list.items.value" :key="auction.id" :auction="auction" />
      </div>
      <div v-if="list.hasNextPage.value" class="row polls__more">
        <AppButton size="sm" :busy="list.isFetchingNextPage.value" @click="list.fetchNextPage()">
          {{ t('auctions.loadMore') }}
        </AppButton>
      </div>
    </AppDataState>
  </div>
</template>
