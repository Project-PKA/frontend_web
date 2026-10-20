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

  it('lists with the filters and the cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await apiWith(request).list({ q: 'ana', consignor: true }, 'abc');
    expect(request).toHaveBeenCalledWith('/v1/customers', {
      query: { q: 'ana', consignor: true, cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('opens, creates and changes a customer', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = apiWith(request);

    await api.get('u/1');
    await api.create({ phone: '5511988771020', name: 'Ana' });
    await api.update('u1', { name: 'Ana S.' });

    expect(request).toHaveBeenNthCalledWith(1, '/v1/customers/u%2F1', { signal: undefined });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/customers', {
      method: 'POST',
      body: { phone: '5511988771020', name: 'Ana' },
    });
    expect(request).toHaveBeenNthCalledWith(3, '/v1/customers/u1', {
      method: 'PATCH',
      body: { name: 'Ana S.' },
    });
  });

  it('puts a customer on the blacklist with a reason, and takes it off', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = apiWith(request);

    await api.blacklist('u1', 'no payment');
    await api.unblacklist('u1');

    expect(request).toHaveBeenNthCalledWith(1, '/v1/customers/u1/blacklist', {
      method: 'POST',
      body: { reason: 'no payment' },
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/customers/u1/blacklist', { method: 'DELETE' });
  });

  it('lists what a customer owes and what they bid', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    const api = apiWith(request);

    await api.settlements('u1');
    await api.bids('u1', 'abc');

    expect(request).toHaveBeenNthCalledWith(1, '/v1/customers/u1/settlements', {
      query: { cursor: undefined, limit: 20 },
      signal: undefined,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/customers/u1/bids', {
      query: { cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('lists the cards a customer consigned', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null, totals: {} });
    await apiWith(request).consignments('u1', 'abc');
    expect(request).toHaveBeenCalledWith('/v1/customers/u1/consignments', {
      query: { cursor: 'abc', limit: 20 },
      signal: undefined,
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
