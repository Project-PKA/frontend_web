import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { searchText } from '../utils/catalog';

/** Wait for the person to stop typing before asking the API. */
const TYPING_DELAY_MS = 250;

/**
 * The as-you-type search of any list for a text the page owns. It asks only for 2 characters
 * or more, after a short pause, and keeps the last list on screen while the next one comes, so
 * the suggestions do not flicker between keystrokes. `key` names the list in the cache and
 * `fetchItems` is the call to the API.
 */
export function useAsYouType<Item>(
  text: Ref<string>,
  key: string,
  fetchItems: (q: string, signal?: AbortSignal) => Promise<{ items: Item[] }>,
) {
  const asked = ref<string | null>(null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(
    text,
    (value) => {
      clearTimeout(timer);
      const next = searchText(value);
      if (next === null) {
        asked.value = null;
        return;
      }
      timer = setTimeout(() => (asked.value = next), TYPING_DELAY_MS);
    },
    { immediate: true },
  );
  onBeforeUnmount(() => clearTimeout(timer));

  const access = useAccessStore();
  const query = useQuery({
    // The store is part of the key: a customer of one store is not a suggestion in another.
    queryKey: computed(() => [key, access.storeId, asked.value]),
    queryFn: ({ signal }) => fetchItems(asked.value ?? '', signal),
    enabled: computed(() => asked.value !== null),
    placeholderData: keepPreviousData,
    // The same text a minute later does not need to be asked again.
    staleTime: 60_000,
  });

  return {
    results: computed<Item[]>(() => (asked.value === null ? [] : (query.data.value?.items ?? []))),
    loading: computed(() => asked.value !== null && query.isFetching.value && !query.data.value),
    error: computed(() => asked.value !== null && query.isError.value),
    retry: () => query.refetch(),
  };
}
