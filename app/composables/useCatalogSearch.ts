import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { createCatalogApi } from '../api/catalog';
import { searchText } from '../utils/catalog';

/** Wait for the person to stop typing before asking the catalog. */
const TYPING_DELAY_MS = 250;

/**
 * The as-you-type search of the catalog for a text the page owns. It asks only for 2 characters
 * or more, after a short pause, and keeps the last list on screen while the next one comes, so
 * the suggestions do not flicker between keystrokes.
 */
export function useCatalogSearch(text: Ref<string>) {
  const api = createCatalogApi(useApi());
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

  const query = useQuery({
    queryKey: computed(() => ['catalog-search', asked.value]),
    queryFn: ({ signal }) => api.search(asked.value ?? '', signal),
    enabled: computed(() => asked.value !== null),
    placeholderData: keepPreviousData,
    // The catalog changes rarely: the same text a minute later does not need to be asked again.
    staleTime: 60_000,
  });

  return {
    results: computed(() => (asked.value === null ? [] : (query.data.value?.items ?? []))),
    loading: computed(() => asked.value !== null && query.isFetching.value && !query.data.value),
    error: computed(() => asked.value !== null && query.isError.value),
    retry: () => query.refetch(),
  };
}
