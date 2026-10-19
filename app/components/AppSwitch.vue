<script setup lang="ts">
import { useId } from 'vue';

/** An on/off switch with its label in the default slot. It is a checkbox for the keyboard and readers. */
defineOptions({ inheritAttrs: false });

defineProps<{
  /** Not toggleable, e.g. while the change is being saved. */
  disabled?: boolean;
}>();

const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
  <label class="switch" :for="id">
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      role="switch"
      :disabled="disabled"
      v-bind="$attrs"
    />
    <span class="switch__track" aria-hidden="true" />
    <slot />
  </label>
</template>
