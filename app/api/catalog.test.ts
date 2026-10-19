import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createCatalogApi } from './catalog';

describe('catalog api', () => {
  it('searches by the text, asking for a short list', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    const signal = new AbortController().signal;

    await createCatalogApi({ request } as unknown as ApiClient).search('pika', signal);

    expect(request).toHaveBeenCalledWith('/v1/catalog/search', {
      query: { q: 'pika', limit: 8 },
      signal,
    });
  });
});
