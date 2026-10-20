<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { createAuctionsApi } from '../api/auctions';
import { formatCountdown } from '../utils/format';
import { cardTitle } from '../utils/inventory';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'waDown.pageTitle',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

/** The minutes the "+30 min" buttons push the end of an auction by. */
const EXTENSION_MINUTES = 30;

const { t } = useI18n();
const errorMessage = useErrorMessage();
const toast = useToast();
const queryClient = useQueryClient();
const api = createAuctionsApi(useApi());
const now = useNow();
const status = useAffectedAuctions();

const down = computed(() => status.data.value?.whatsapp_status !== 'ONLINE');
const items = computed(() => status.data.value?.items ?? []);
const waiting = computed(() => status.data.value?.whatsapp_status === 'QR_READY');

const rows = computed(() =>
  items.value.map((item) => ({
    id: item.id,
    code: item.card.short_code,
    title: cardTitle(item.card.catalog),
    left: formatCountdown(new Date(item.end_time).getTime() - now.value),
    bids: item.bid_count,
  })),
);
const columns = computed(() => [
  { key: 'card', label: t('auctions.columns.card') },
  { key: 'left', label: t('waDown.endsIn') },
  { key: 'bids', label: t('auctions.columns.bids'), numeric: true },
  { key: 'action', label: '' },
]);

// ---- Extending: one auction, or all of them
const busy = ref<string | null>(null);
const failure = ref<string | null>(null);

async function extend(target: string) {
  busy.value = target;
  failure.value = null;
  try {
    if (target === 'all') await api.extendAll(EXTENSION_MINUTES);
    else await api.extend(target, EXTENSION_MINUTES);
    await Promise.all(
      ['affected', 'auctions', 'auction', 'home'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
    toast.success(t('waDown.extended', { minutes: EXTENSION_MINUTES }));
  } catch (error) {
    failure.value = errorMessage(error);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="stack">
    <AppState v-if="status.isPending.value" kind="loading" :title="t('waDown.loading')" />
    <AppState
      v-else-if="status.isError.value"
      kind="error"
      :title="t('waDown.error.title')"
      :text="t('waDown.error.text')"
      :action-label="t('waDown.error.retry')"
      @action="status.refetch()"
    />

    <template v-else>
      <div v-if="down" class="alert alert--danger" role="alert">
        <AppIcon name="alert" />
        <div class="alert__body">
          <p class="alert__title">{{ t('waDown.title') }}</p>
          <span class="muted">
            {{
              items.length > 0
                ? t('waDown.affected', { count: items.length }, items.length)
                : t('waDown.noneAffected')
            }}
            {{ t('waDown.reconnectHint') }}
          </span>
        </div>
      </div>
      <div v-else class="alert alert--success" role="status">
        <AppIcon name="check" />
        <div class="alert__body">
          <p class="alert__title">{{ t('waDown.online.title') }}</p>
          <span class="muted">{{ t('waDown.online.text') }}</span>
        </div>
      </div>

      <div class="cols-2 waDown__cols">
        <AppCard as="section" :title="t('waDown.qr.title')" :aria-label="t('waDown.qr.title')">
          <template #head>
            <AppBadge :tone="down ? 'warning' : 'success'">
              {{
                down
                  ? waiting
                    ? t('waDown.qr.waiting')
                    : t('waDown.qr.disconnected')
                  : t('waDown.qr.connected')
              }}
            </AppBadge>
          </template>
          <ol class="muted waDown__steps">
            <li>{{ t('waDown.qr.step1') }}</li>
            <li>{{ t('waDown.qr.step2') }}</li>
            <li>{{ t('waDown.qr.step3') }}</li>
          </ol>
          <p v-if="down" class="muted waDown__note">{{ t('waDown.qr.soon') }}</p>
        </AppCard>

        <AppCard
          as="section"
          :title="t('waDown.table.title')"
          :aria-label="t('waDown.table.title')"
        >
          <AppState v-if="rows.length === 0" kind="empty" :title="t('waDown.table.empty')" />
          <template v-else>
            <AppTable
              :caption="t('waDown.table.title')"
              :columns="columns"
              :rows="rows"
              :row-key="(row) => row.id"
            >
              <template #cell-card="{ row }">
                <span class="id-chip">#{{ row.code }}</span>
                <NuxtLink class="auctions__card" :to="`/auctions/${row.id}`">{{
                  row.title
                }}</NuxtLink>
              </template>
              <template #cell-left="{ row }">
                <span class="mono">{{ row.left }}</span>
              </template>
              <template #cell-action="{ row }">
                <AppButton
                  size="sm"
                  :busy="busy === row.id"
                  :disabled="busy !== null"
                  @click="extend(row.id)"
                >
                  {{ t('waDown.table.plus', { minutes: EXTENSION_MINUTES }) }}
                </AppButton>
              </template>
            </AppTable>
            <div class="row waDown__all">
              <AppButton :busy="busy === 'all'" :disabled="busy !== null" @click="extend('all')">
                {{ t('waDown.table.extendAll', { minutes: EXTENSION_MINUTES }) }}
              </AppButton>
            </div>
            <p v-if="failure" role="alert" class="hint hint--error waDown__error">{{ failure }}</p>
          </template>
          <template #foot>{{ t('waDown.table.foot') }}</template>
        </AppCard>
      </div>
    </template>
  </div>
</template>
