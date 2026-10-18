<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';
import type { ToastTone } from '../stores/toasts';

const props = withDefaults(
  defineProps<{
    tone?: ToastTone;
    message: string;
    closeLabel: string;
    /** Milliseconds until it goes away by itself; 0 keeps it until it is dismissed. */
    duration?: number;
  }>(),
  { tone: 'info', duration: 6000 },
);

const emit = defineEmits<{ dismiss: [] }>();

const ICONS: Record<ToastTone, string> = {
  success: 'check',
  info: 'bell',
  warning: 'alert',
  danger: 'alert',
};

let timer: ReturnType<typeof setTimeout> | undefined;
let remaining = props.duration;
let startedAt = 0;

function start() {
  if (props.duration <= 0) return;
  startedAt = Date.now();
  timer = setTimeout(() => emit('dismiss'), remaining);
}

/** Hovering or focusing the toast pauses the countdown, so there is time to read it. */
function pause() {
  if (timer === undefined) return;
  clearTimeout(timer);
  timer = undefined;
  remaining = Math.max(remaining - (Date.now() - startedAt), 0);
}

onMounted(start);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div
    :class="['alert', 'toast', `alert--${tone}`]"
    @pointerenter="pause"
    @pointerleave="start"
    @focusin="pause"
    @focusout="start"
  >
    <AppIcon :name="ICONS[tone]" />
    <div class="alert__body">
      <p>{{ message }}</p>
    </div>
    <AppButton icon variant="ghost" size="sm" :label="closeLabel" @click="emit('dismiss')">
      <AppIcon name="x" />
    </AppButton>
  </div>
</template>
