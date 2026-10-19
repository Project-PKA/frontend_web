import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createDashboardApi } from './dashboard';

describe('dashboard api', () => {
  it('asks for the live home of the store', async () => {
    const request = vi.fn().mockResolvedValue({});
    const signal = new AbortController().signal;

    await createDashboardApi({ request } as unknown as ApiClient).home(signal);

    expect(request).toHaveBeenCalledWith('/v1/dashboard/home', { signal });
  });
});
