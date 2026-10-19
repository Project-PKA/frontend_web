<script setup lang="ts">
import { AUCTION_TABS, type AuctionTab } from '../../utils/auctions';

definePageMeta({
  i18n: false,
  layout: 'app',
  titleKey: 'nav.auctions',
  access: { level: 'store', permission: 'can_manage_auctions' },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const tabs = computed(() => AUCTION_TABS.map((id) => ({ id, label: t(`auctions.tabs.${id}`) })));
const active = ref<string>('active');

// `/auctions?new=1` (the Home's "Schedule") opens the form at once.
const creating = ref(route.query.new !== undefined);
function closeCreate() {
  creating.value = false;
  if (route.query.new !== undefined) void router.replace({ query: {} });
}
</script>

<template>
  <div class="stack">
    <div class="page-head">
      <h2>{{ t('auctions.title') }}</h2>
      <div class="row">
        <AppButton variant="primary" @click="creating = true">
          <AppIcon name="plus" />
          {{ t('auctions.new') }}
        </AppButton>
      </div>
    </div>

    <AppTabs v-model="active" :tabs="tabs" :label="t('auctions.tabs.label')">
      <template #default="{ active: current }">
        <AuctionList :key="current" :tab="current as AuctionTab" />
      </template>
    </AppTabs>

    <AuctionCreate :open="creating" @close="closeCreate" />
  </div>
</template>
