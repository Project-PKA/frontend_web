<script setup lang="ts">
import AppToast from './AppToast.vue';

/**
 * Shows the toasts. It sits in `app.vue`, always rendered, because a screen reader only
 * announces what is added to a live region that was already on the page. Errors go to an
 * assertive region and stay until dismissed; the rest are polite and go away by themselves.
 */
const { t } = useI18n();
const store = useToastStore();

const quiet = computed(() => store.toasts.filter((toast) => toast.tone !== 'danger'));
const urgent = computed(() => store.toasts.filter((toast) => toast.tone === 'danger'));
</script>

<template>
  <div class="toast-region">
    <div role="status" aria-live="polite" :aria-label="t('toast.region')">
      <AppToast
        v-for="toast in quiet"
        :key="toast.id"
        :tone="toast.tone"
        :message="toast.message"
        :close-label="t('toast.close')"
        @dismiss="store.dismiss(toast.id)"
      />
    </div>
    <div role="alert">
      <AppToast
        v-for="toast in urgent"
        :key="toast.id"
        :tone="toast.tone"
        :message="toast.message"
        :close-label="t('toast.close')"
        :duration="0"
        @dismiss="store.dismiss(toast.id)"
      />
    </div>
  </div>
</template>
