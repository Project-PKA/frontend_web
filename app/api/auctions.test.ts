import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createAuctionsApi } from './auctions';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createAuctionsApi({ request } as unknown as ApiClient);
}

describe('auctions api', () => {
  it('lists the auctions of one status, from the cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await apiWith(request).list('PENDING', 'abc');
    expect(request).toHaveBeenCalledWith('/v1/auctions', {
      query: { status: 'PENDING', cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('opens one auction by its id, safely encoded', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).get('a/b');
    expect(request).toHaveBeenCalledWith('/v1/auctions/a%2Fb', { signal: undefined });
  });

  it('creates an auction with the body as it is', async () => {
    const request = vi.fn().mockResolvedValue({});
    const body = {
      card_id: 'c1',
      type: 'FREE_BID',
      end_time: '2026-10-20T22:00:00.000Z',
      initial_bid: '20.00',
      min_increment: '5.00',
    } as const;

    await apiWith(request).create(body);

    expect(request).toHaveBeenCalledWith('/v1/auctions', { method: 'POST', body });
  });

  it('changes only what it is given', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).update('a1', { end_time: '2026-10-20T23:00:00.000Z' });
    expect(request).toHaveBeenCalledWith('/v1/auctions/a1', {
      method: 'PATCH',
      body: { end_time: '2026-10-20T23:00:00.000Z' },
    });
  });

  it('cancels an auction', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).cancel('a1');
    expect(request).toHaveBeenCalledWith('/v1/auctions/a1/cancel', { method: 'POST' });
  });
});
