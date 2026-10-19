import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createCustomersApi } from './customers';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createCustomersApi({ request } as unknown as ApiClient);
}

describe('customers api', () => {
  it('searches by the text, asking for a short list', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    const signal = new AbortController().signal;

    await apiWith(request).search('ana', signal);

    expect(request).toHaveBeenCalledWith('/v1/customers', {
      query: { q: 'ana', limit: 8 },
      signal,
    });
  });

  it('creates the consignor link for one customer', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).createConsignorLink('u/1');
    expect(request).toHaveBeenCalledWith('/v1/customers/u%2F1/consignor-link', {
      method: 'POST',
      body: {},
    });
  });
});
