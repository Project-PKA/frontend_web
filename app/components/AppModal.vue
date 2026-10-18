<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import AppButton from './AppButton.vue';
import AppCard from './AppCard.vue';
import AppIcon from './AppIcon.vue';

/**
 * A modal dialog on the native `<dialog>`: the browser keeps focus inside it, makes the
 * rest of the page inert, closes it with Esc and gives focus back to what opened it.
 */
const props = defineProps<{
  open: boolean;
  /** The name of the dialog, shown as its heading. */
  title: string;
  /** Accessible name of the close button. */
  closeLabel: string;
}>();

/** The person asked to close it (Esc, the close button, a click outside). The parent decides. */
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const titleId = `modal-${useId()}`;

function sync() {
  const element = dialog.value;
  if (!element) return;
  if (props.open && !element.open) element.showModal();
  else if (!props.open && element.open) element.close();
}

onMounted(() => {
  sync();
  dialog.value?.addEventListener('click', onBackdropClick);
});
onBeforeUnmount(() => dialog.value?.removeEventListener('click', onBackdropClick));
watch(
  () => props.open,
  () => nextTick(sync),
);

/** Esc: keep the dialog open until the parent says so, so it can ask for confirmation first. */
function onCancel(event: Event) {
  event.preventDefault();
  emit('close');
}

/**
 * A click on the dialog itself, not on its content, is a click on the backdrop. It is a
 * convenience for the mouse (Esc and the close button are the keyboard way), so it is
 * attached here and not as a template handler on a non-interactive element.
 */
function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close');
}
</script>

<template>
  <dialog ref="dialog" class="modal-dialog" :aria-labelledby="titleId" @cancel="onCancel">
    <AppCard class="modal">
      <template #head>
        <h2 :id="titleId" class="card__title">{{ title }}</h2>
        <AppButton icon variant="ghost" size="sm" :label="closeLabel" @click="emit('close')">
          <AppIcon name="x" />
        </AppButton>
      </template>
      <slot />
      <template v-if="$slots.foot" #foot>
        <slot name="foot" />
      </template>
    </AppCard>
  </dialog>
</template>
