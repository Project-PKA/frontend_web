import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { ApiError } from '../api/errors';
import { nextCursor, useCursorList, type CursorPage, type FetchPage } from './cursor-list';

describe('nextCursor', () => {
  it('is the cursor of the page', () => {
    expect(nextCursor({ items: [], next_cursor: 'abc' })).toBe('abc');
  });

  it('is nothing on the last page', () => {
    expect(nextCursor({ items: [], next_cursor: null })).toBeUndefined();
  });
});

const pages: Record<string, CursorPage<string>> = {
  first: { items: ['a', 'b'], next_cursor: 'second' },
  second: { items: ['c'], next_cursor: null },
};

function setup(fetchPage: FetchPage<string>, options: { enabled?: boolean } = {}) {
  const enabled = ref(options.enabled ?? true);
  let list!: ReturnType<typeof useCursorList<string>>;
  const Probe = defineComponent({
    setup() {
      list = useCursorList<string>({ queryKey: ['test-list'], fetchPage, enabled });
      return () => null;
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount(Probe, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { list: () => list, enabled };
}

describe('useCursorList', () => {
  it('loads the first page without a cursor', async () => {
    const fetchPage = vi.fn(async (cursor?: string) => pages[cursor ?? 'first']!);
    const { list } = setup(fetchPage);

    expect(list().isLoading.value).toBe(true);
    await flushPromises();

    expect(fetchPage.mock.calls[0]![0]).toBeUndefined();
    expect(list().isLoading.value).toBe(false);
    expect(list().items.value).toEqual(['a', 'b']);
    expect(list().hasNextPage.value).toBe(true);
  });

  it('asks for the next page with the cursor and joins the pages', async () => {
    const fetchPage = vi.fn(async (cursor?: string) => pages[cursor ?? 'first']!);
    const { list } = setup(fetchPage);
    await flushPromises();

    await list().fetchNextPage();
    await flushPromises();

    expect(fetchPage.mock.calls[1]![0]).toBe('second');
    expect(list().items.value).toEqual(['a', 'b', 'c']);
    expect(list().hasNextPage.value).toBe(false);
  });

  it('reports an error and lets the page try again', async () => {
    const fetchPage = vi
      .fn<FetchPage<string>>()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValue(pages.second!);
    const { list } = setup(fetchPage);
    await flushPromises();

    expect(list().isError.value).toBe(true);
    expect(list().error.value).toMatchObject({ kind: 'network' });
    expect(list().items.value).toEqual([]);

    await list().refetch();
    await flushPromises();

    expect(list().isError.value).toBe(false);
    expect(list().items.value).toEqual(['c']);
  });

  it('does not load while it is disabled', async () => {
    const fetchPage = vi.fn(async () => pages.first!);
    const { enabled } = setup(fetchPage, { enabled: false });
    await flushPromises();
    expect(fetchPage).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('has no items while nothing was loaded', () => {
    const { list } = setup(() => new Promise(() => undefined));
    expect(list().items.value).toEqual([]);
    expect(list().hasNextPage.value).toBe(false);
  });
});
