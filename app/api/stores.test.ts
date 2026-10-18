import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createStoresApi } from './stores';

describe('stores api', () => {
  it('lists the stores of the person', async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    await createStoresApi({ request } as unknown as ApiClient).listMine();
    expect(request).toHaveBeenCalledWith('/v1/me/stores');
  });

  it('creates a store with its name', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createStoresApi({ request } as unknown as ApiClient).create('Poké Card Hub');
    expect(request).toHaveBeenCalledWith('/v1/stores', {
      method: 'POST',
      body: { name: 'Poké Card Hub' },
    });
  });
});
