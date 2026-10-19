import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createPreferencesApi } from './preferences';

describe('preferences api', () => {
  it('reads the preferences', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createPreferencesApi({ request } as unknown as ApiClient).get();
    expect(request).toHaveBeenCalledWith('/v1/me/preferences');
  });

  it('sends only what changed', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createPreferencesApi({ request } as unknown as ApiClient).update({ language: 'pt-BR' });
    expect(request).toHaveBeenCalledWith('/v1/me/preferences', {
      method: 'PATCH',
      body: { language: 'pt-BR' },
    });
  });
});
