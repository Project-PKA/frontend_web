import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createFinanceApi } from './finance';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createFinanceApi({ request } as unknown as ApiClient);
}

describe('finance api', () => {
  it('asks for the overview of a period', async () => {
    const request = vi.fn().mockResolvedValue({});
    const signal = new AbortController().signal;
    await apiWith(request).overview('7', signal);
    expect(request).toHaveBeenCalledWith('/v1/finance/overview', {
      query: { period: '7' },
      signal,
    });
  });

  it('asks for the five top buyers of the period', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    await apiWith(request).topBuyers('30');
    expect(request).toHaveBeenCalledWith('/v1/finance/top-buyers', {
      query: { period: '30', limit: 5 },
      signal: undefined,
    });
  });

  it('asks for the payouts of the period', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    await apiWith(request).payouts('today');
    expect(request).toHaveBeenCalledWith('/v1/finance/consignment-payouts', {
      query: { period: 'today' },
      signal: undefined,
    });
  });
});
