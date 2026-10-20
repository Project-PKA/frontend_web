<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue';
import { MAX_PHOTOS, PHOTO_TYPES, checkPhotos, type PhotoProblem } from '../utils/card-form';
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';

/**
 * The real photos of a card, chosen before the card exists: they are only held here (with a
 * preview each) and sent by the page after the card is saved. It keeps JPEG, PNG and WebP up to
 * 5 MB and 8 in all, and says which files it left out and why.
 */
const props = defineProps<{
  label: string;
  /** "Add photos". */
  add: string;
  /** "JPEG, PNG or WebP, up to 5 MB each and 8 photos." */
  hint: string;
  /** Accessible name of the button that takes a photo out: "Remove photo 2". */
  remove: (position: number) => string;
  /** The text for a file that was left out, e.g. `"big.png" is over 5 MB.` */
  problem: (name: string, reason: PhotoProblem) => string;
  /** Accessible name of a preview: "Photo 2". */
  preview: (position: number) => string;
  disabled?: boolean;
}>();

const files = defineModel<File[]>('files', { default: () => [] });

const inputId = useId();
const problems = ref<string[]>([]);
const addresses = new Map<File, string>();
const previews = ref<{ file: File; address: string }[]>([]);

// One temporary address per file, released as soon as the file leaves the list or the page.
watch(
  files,
  (current) => {
    for (const [file, address] of addresses) {
      if (!current.includes(file)) {
        URL.revokeObjectURL(address);
        addresses.delete(file);
      }
    }
    for (const file of current) {
      if (!addresses.has(file)) addresses.set(file, URL.createObjectURL(file));
    }
    previews.value = current.map((file) => ({ file, address: addresses.get(file) ?? '' }));
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  for (const address of addresses.values()) URL.revokeObjectURL(address);
  addresses.clear();
});

function onPick(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = [...(input.files ?? [])];
  const result = checkPhotos(files.value.length, picked);
  problems.value = result.rejected.map((item) => props.problem(item.name, item.reason));
  if (result.accepted.length > 0) files.value = [...files.value, ...result.accepted];
  // The same file can be picked again after it was removed.
  input.value = '';
}

function take(index: number) {
  files.value = files.value.filter((_, position) => position !== index);
  problems.value = [];
}
</script>

<template>
  <div class="stack photo-picker">
    <span class="label">{{ label }}</span>
    <ul v-if="previews.length > 0" class="photos photo-picker__list">
      <li v-for="(item, index) in previews" :key="item.address" class="photo-picker__item">
        <img :src="item.address" :alt="preview(index + 1)" />
        <AppButton
          icon
          size="sm"
          variant="secondary"
          :label="remove(index + 1)"
          :disabled="disabled"
          @click="take(index)"
        >
          <AppIcon name="x" />
        </AppButton>
      </li>
    </ul>
    <label v-if="files.length < MAX_PHOTOS" class="drop photo-picker__add" :for="inputId">
      <AppIcon name="plus" />
      {{ add }}
      <input
        :id="inputId"
        class="visually-hidden"
        type="file"
        multiple
        :accept="PHOTO_TYPES.join(',')"
        :disabled="disabled"
        @change="onPick"
      />
    </label>
    <p class="hint">{{ hint }}</p>
    <ul v-if="problems.length > 0" class="photo-picker__problems" role="alert">
      <li v-for="text in problems" :key="text" class="hint hint--error">{{ text }}</li>
    </ul>
  </div>
</template>
