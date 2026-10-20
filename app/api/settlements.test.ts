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
});
