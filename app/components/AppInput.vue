<script setup lang="ts">
/** A labelled text input. Other attributes (`type`, `autocomplete`, `required`, ...) go to the `<input>`. */
import { computed, ref, useId } from 'vue';
import { fieldIds } from '../utils/field-ids';
import AppFieldMessages from './AppFieldMessages.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  label: string;
  hint?: string;
  error?: string | null;
  id?: string;
}>();

const model = defineModel<string>({ default: '' });

const input = ref<HTMLInputElement | null>(null);

defineExpose({ focus: () => input.value?.focus() });

const generated = useId();
const ids = computed(() => fieldIds({ ...props, generated }));
</script>

<template>
  <div class="field">
    <label class="field" :for="ids.control">
      <span class="label">{{ label }}</span>
      <input
        :id="ids.control"
        ref="input"
        v-model="model"
        class="input"
        v-bind="$attrs"
        :aria-describedby="ids.describedby"
        :aria-invalid="error ? 'true' : undefined"
      />
    </label>
    <AppFieldMessages :hint="hint" :error="error" :hint-id="ids.hint" :error-id="ids.error" />
  </div>
</template>
