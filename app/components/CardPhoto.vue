<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { createInventoryApi } from '../api/inventory';

/**
 * A real photo of a card. It needs the login, so it is downloaded through the API client and
 * shown from a temporary address that is released when it leaves the screen.
 */
const props = defineProps<{
  cardId: string;
  photoId: string;
  /** What the photo is, already translated, e.g. "Photo 1 of Charizard ex". */
  alt: string;
  /** Shown while it loads and when it does not load. */
  loadingText: string;
  errorText: string;
}>();

const api = createInventoryApi(useApi());
const address = ref<string | null>(null);
const failed = ref(false);
let controller: AbortController | null = null;

function release() {
  if (address.value) URL.revokeObjectURL(address.value);
  address.value = null;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  release();
  failed.value = false;
  try {
    const file = await api.photo(props.cardId, props.photoId, controller.signal);
    address.value = URL.createObjectURL(file);
  } catch {
    if (!controller.signal.aborted) failed.value = true;
  }
}

watch(() => [props.cardId, props.photoId], load, { immediate: true });
onBeforeUnmount(() => {
  controller?.abort();
  release();
});
</script>

<template>
  <figure class="card-photo">
    <img v-if="address" :src="address" :alt="alt" />
    <figcaption v-else class="muted" :role="failed ? 'alert' : 'status'">
      {{ failed ? errorText : loadingText }}
    </figcaption>
  </figure>
</template>
