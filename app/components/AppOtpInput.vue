<script setup lang="ts">
import { nextTick, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Name of the whole group, e.g. "6-digit code". */
    label: string;
    /** Name of one box, e.g. "Digit 2 of 6". */
    digitLabel: (position: number, total: number) => string;
    length?: number;
    disabled?: boolean;
    invalid?: boolean;
    describedby?: string;
    /** The wider boxes of the consignor access key. */
    keys?: boolean;
  }>(),
  { length: 6, describedby: undefined },
);

const emit = defineEmits<{ complete: [code: string] }>();

/** The digits typed so far, with no gaps: the boxes fill from the left. */
const model = defineModel<string>({ default: '' });

const boxes = ref<HTMLInputElement[]>([]);

const digits = (text: string) => text.replace(/\D/g, '');

/** Puts the cursor in the first empty box, or the last one when the code is full. */
defineExpose({ focus: () => focusBox(model.value.length) });

async function focusBox(index: number) {
  const target = Math.max(0, Math.min(index, props.length - 1));
  await nextTick();
  boxes.value[target]?.focus();
  boxes.value[target]?.select();
}

function update(value: string, focusIndex: number) {
  const next = value.slice(0, props.length);
  model.value = next;
  if (next.length === props.length) emit('complete', next);
  void focusBox(focusIndex);
}

/** Typing or autofill. A browser may put the whole code in one box, so take every digit. */
function onInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  const typed = digits(input.value);
  if (typed === '') {
    // Not a digit: put the box back as it was.
    input.value = model.value[index] ?? '';
    return;
  }
  const value = model.value;
  const next =
    index < value.length ? value.slice(0, index) + typed + value.slice(index + 1) : value + typed;
  update(next, Math.min(next.length, props.length - 1));
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    event.preventDefault();
    const value = model.value;
    if (index < value.length) update(value.slice(0, index) + value.slice(index + 1), index);
    else if (index > 0) update(value.slice(0, index - 1) + value.slice(index), index - 1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    void focusBox(index - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    void focusBox(index + 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    void focusBox(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    void focusBox(props.length - 1);
  }
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault();
  const pasted = digits(event.clipboardData?.getData('text') ?? '').slice(0, props.length);
  if (pasted !== '') update(pasted, Math.min(pasted.length, props.length - 1));
}
</script>

<template>
  <div
    :class="['otp', keys && 'otp--keys']"
    role="group"
    :aria-label="label"
    :aria-describedby="describedby"
  >
    <input
      v-for="(_, index) in length"
      :key="index"
      :ref="
        (element) => {
          if (element) boxes[index] = element as HTMLInputElement;
        }
      "
      :value="model[index] ?? ''"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      :aria-label="digitLabel(index + 1, length)"
      :aria-invalid="invalid ? 'true' : undefined"
      :disabled="disabled"
      @input="onInput(index, $event)"
      @keydown="onKeydown(index, $event)"
      @paste="onPaste"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>
