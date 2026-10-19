import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createInventoryApi } from './inventory';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createInventoryApi({ request } as unknown as ApiClient);
}

describe('inventory api', () => {
  it('lists with the filters and the cursor, leaving the empty ones out', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });

    await apiWith(request).list({ q: 'pika', status: 'AVAILABLE' }, 'abc');

    expect(request).toHaveBeenCalledWith('/v1/cards', {
      query: { q: 'pika', status: 'AVAILABLE', cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('opens a card by its id, safely encoded', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).get('a/b');
    expect(request).toHaveBeenCalledWith('/v1/cards/a%2Fb', { signal: undefined });
  });

  it('deletes a card', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    await apiWith(request).remove('c1');
    expect(request).toHaveBeenCalledWith('/v1/cards/c1', { method: 'DELETE' });
  });

  it('downloads a photo as a file', async () => {
    const request = vi.fn().mockResolvedValue(new Blob());
    await apiWith(request).photo('c1', 'p1.png');
    expect(request).toHaveBeenCalledWith('/v1/cards/c1/photos/p1.png', {
      parse: 'blob',
      signal: undefined,
    });
  });
});
