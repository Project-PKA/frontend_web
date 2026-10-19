<script setup lang="ts">
/** A labelled multi-line text field. Other attributes go to the `<textarea>`. */
import { computed, useId } from 'vue';
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

const generated = useId();
const ids = computed(() => fieldIds({ ...props, generated }));
</script>

<template>
  <div class="field">
    <label class="field" :for="ids.control">
      <span class="label">{{ label }}</span>
      <textarea
        :id="ids.control"
        v-model="model"
        class="textarea"
        v-bind="$attrs"
        :aria-describedby="ids.describedby"
        :aria-invalid="error ? 'true' : undefined"
      />
    </label>
    <AppFieldMessages :hint="hint" :error="error" :hint-id="ids.hint" :error-id="ids.error" />
  </div>
</template>
