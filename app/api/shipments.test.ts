import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createShipmentsApi } from './shipments';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createShipmentsApi({ request } as unknown as ApiClient);
}

describe('shipments api', () => {
  it('lists the queue with the status and the cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await apiWith(request).list('SHIPPED', 'abc');
    expect(request).toHaveBeenCalledWith('/v1/shipments', {
      query: { status: 'SHIPPED', cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('changes the status and the tracking code of one shipment', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).update('s/1', { status: 'SHIPPED', tracking_code: 'BR1' });
    expect(request).toHaveBeenCalledWith('/v1/shipments/s%2F1', {
      method: 'PATCH',
      body: { status: 'SHIPPED', tracking_code: 'BR1' },
    });
  });
});
