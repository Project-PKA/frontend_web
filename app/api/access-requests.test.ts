import { describe, expect, it, vi } from 'vitest';
import { createAccessRequestsApi } from './access-requests';
import type { ApiClient } from './client';

describe('access requests api', () => {
  it('sends the request without a session', async () => {
    const request = vi.fn().mockResolvedValue({ status: 'RECEIVED' });
    const body = { name: 'Ana', email: 'ana@example.com', store_name: 'Hub', website: '' };

    await createAccessRequestsApi({ request } as unknown as ApiClient).request(body);

    expect(request).toHaveBeenCalledWith('/v1/public/access-requests', {
      method: 'POST',
      body,
      anonymous: true,
    });
  });
});
