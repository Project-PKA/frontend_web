import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createAdminApi } from './admin';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createAdminApi({ request } as unknown as ApiClient);
}

describe('admin api', () => {
  it('reads the dashboard', async () => {
    const request = vi.fn().mockResolvedValue({});
    const signal = new AbortController().signal;
    await apiWith(request).dashboard(signal);
    expect(request).toHaveBeenCalledWith('/v1/admin/dashboard', { signal });
  });

  it('lists the access requests of a status, a short page by default', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await apiWith(request).accessRequests('PENDING');
    expect(request).toHaveBeenCalledWith('/v1/admin/access-requests', {
      query: { status: 'PENDING', limit: 5 },
      signal: undefined,
    });
  });
});
