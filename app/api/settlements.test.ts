import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createSettlementsApi } from './settlements';

describe('settlements api', () => {
  it('confirms the payment of one settlement', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createSettlementsApi({ request } as unknown as ApiClient).markPaid('s/1');
    expect(request).toHaveBeenCalledWith('/v1/settlements/s%2F1/paid', {
      method: 'POST',
      body: {},
    });
  });

  it('lists the settlements of a status, by cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await createSettlementsApi({ request } as unknown as ApiClient).list('PENDING', 'abc');
    expect(request).toHaveBeenCalledWith('/v1/settlements', {
      query: { status: 'PENDING', cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('lists the buyers waiting for a settlement', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    const signal = new AbortController().signal;
    await createSettlementsApi({ request } as unknown as ApiClient).awaiting(signal);
    expect(request).toHaveBeenCalledWith('/v1/settlements/awaiting', { signal });
  });

  it('creates the settlement of a buyer with the auctions they won', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createSettlementsApi({ request } as unknown as ApiClient).create('c1', ['a1', 'a2']);
    expect(request).toHaveBeenCalledWith('/v1/settlements', {
      method: 'POST',
      body: { customer_id: 'c1', auction_ids: ['a1', 'a2'] },
    });
  });

  it('makes the link of a settlement, which lasts 14 days', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createSettlementsApi({ request } as unknown as ApiClient).createLink('s/1');
    expect(request).toHaveBeenCalledWith('/v1/settlements/s%2F1/public-link', {
      method: 'POST',
      body: { expires_in_days: 14 },
    });
  });

  it('downloads the receipt as a file', async () => {
    const request = vi.fn().mockResolvedValue(new Blob());
    const signal = new AbortController().signal;
    await createSettlementsApi({ request } as unknown as ApiClient).receipt('s/1', signal);
    expect(request).toHaveBeenCalledWith('/v1/settlements/s%2F1/receipt', {
      parse: 'blob',
      signal,
    });
  });
});
