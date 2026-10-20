<script setup lang="ts">
/**
 * The warning of the Home when the store's WhatsApp is not connected: how many running auctions are
 * not receiving bids, and the way to the page that reconnects. It shows nothing while the WhatsApp
 * is online (or when it could not be asked).
 */
const { t } = useI18n();
const status = useAffectedAuctions();

const down = computed(() => {
  const data = status.data.value;
  return data !== undefined && data.whatsapp_status !== 'ONLINE';
});
const count = computed(() => status.data.value?.items.length ?? 0);
</script>

<template>
  <div v-if="down" class="alert alert--danger" role="alert">
    <AppIcon name="alert" />
    <div class="alert__body">
      <p class="alert__title">{{ t('waDown.title') }}</p>
      <span class="muted">
        {{ count > 0 ? t('waDown.affected', { count }, count) : t('waDown.noneAffected') }}
      </span>
    </div>
    <AppButton variant="danger" size="sm" to="/whatsapp">{{ t('waDown.reconnect') }}</AppButton>
  </div>
</template>
