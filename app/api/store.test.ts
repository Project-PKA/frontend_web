import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createStoreApi } from './store';

describe('store api', () => {
  it('sets the inactivity limit, and turns it off with null', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = createStoreApi({ request } as unknown as ApiClient);

    await api.setInactivityLimit(60);
    await api.setInactivityLimit(null);

    expect(request).toHaveBeenNthCalledWith(1, '/v1/store', {
      method: 'PATCH',
      body: { inactivity_days_limit: 60 },
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/store', {
      method: 'PATCH',
      body: { inactivity_days_limit: null },
    });
  });
});
