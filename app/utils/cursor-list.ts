import { useInfiniteQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';

/** The shape of every list of the API: `items` and the cursor of the next page. */
export interface CursorPage<Item> {
  items: Item[];
  next_cursor: string | null;
}

export type FetchPage<Item> = (
  cursor: string | undefined,
  signal?: AbortSignal,
) => Promise<CursorPage<Item>>;

/** The cursor to ask for the next page, or `undefined` when this was the last one. */
export function nextCursor<Item>(page: CursorPage<Item>): string | undefined {
  return page.next_cursor ?? undefined;
}

export interface CursorListOptions<Item> {
  /** Must include everything the list depends on (filters, store...). */
  queryKey: MaybeRefOrGetter<readonly unknown[]>;
  fetchPage: FetchPage<Item>;
  enabled?: MaybeRefOrGetter<boolean>;
  /** Poll while the component is on screen, in milliseconds (the live Home). */
  refetchInterval?: MaybeRefOrGetter<number | false>;
}

/**
 * A list paginated by cursor (`cursor`, `limit`, `next_cursor`). All the loaded
 * pages come back as one array; `fetchNextPage` asks for the next one.
 */
export function useCursorList<Item>(options: CursorListOptions<Item>) {
  // Options as a getter, so the key, `enabled` and the interval can change over time.
  const query = useInfiniteQuery(() => ({
    queryKey: toValue(options.queryKey),
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      options.fetchPage(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: toValue(options.enabled ?? true),
    refetchInterval: toValue(options.refetchInterval ?? false),
  }));

  const items = computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? []);

  return {
    items,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    /** The first page is loading. */
    isLoading: query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
