import { describe, expect, it, vi } from 'vitest';
import { createAccessApi } from './access';
import type { ApiClient } from './client';

describe('access api', () => {
  it('reads the profile and the current store', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = createAccessApi({ request } as unknown as ApiClient);

    await api.getMe();
    await api.getStore();

    expect(request.mock.calls).toEqual([['/v1/me'], ['/v1/store']]);
  });
});
