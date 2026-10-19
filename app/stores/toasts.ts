import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  id: number;
  tone: ToastTone;
  /** Already translated. */
  message: string;
}

/** More than this on screen at once is noise: the oldest go away first. */
export const MAX_TOASTS = 4;

/** The short messages shown after an action ("Saved", "Could not send"). */
export const useToastStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([]);
  let lastId = 0;

  function show(message: string, tone: ToastTone = 'info'): number {
    lastId += 1;
    toasts.value = [...toasts.value, { id: lastId, tone, message }].slice(-MAX_TOASTS);
    return lastId;
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function clear() {
    toasts.value = [];
  }

  return { toasts, show, dismiss, clear };
});
