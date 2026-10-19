<script setup lang="ts">
import { pollLabels } from '../utils/home';

/** The warning about poll auctions that wait for validation of their maximum value. */
const { t } = useI18n();
const access = useAccessStore();
const labels = useHomeData((home) => pollLabels(home.poll_alerts));
</script>

<template>
  <div v-if="labels.data.value?.length" class="alert alert--warning" role="alert">
    <AppIcon name="alert" />
    <div class="alert__body">
      <p class="alert__title">
        {{
          t('home.pollAlert.title', { count: labels.data.value.length }, labels.data.value.length)
        }}
      </p>
      <span class="muted">{{ labels.data.value.join(' · ') }}</span>
    </div>
    <AppButton v-if="access.can('can_manage_auctions')" variant="primary" size="sm" to="/auctions">
      {{ t('home.pollAlert.action') }}
    </AppButton>
  </div>
</template>
