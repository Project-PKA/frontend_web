/**
 * The current instant in milliseconds, updated on its own every `everyMs` (a second by default),
 * for a countdown or a "ago" that has to keep moving. It stops when the page goes away.
 */
export function useNow(everyMs = 1000) {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;

  onMounted(() => {
    now.value = Date.now();
    timer = setInterval(() => (now.value = Date.now()), everyMs);
  });
  onBeforeUnmount(() => clearInterval(timer));

  return now;
}
