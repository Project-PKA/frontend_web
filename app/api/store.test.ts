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

  it('changes the store with only what was given', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createStoreApi({ request } as unknown as ApiClient).update({
      pix_key: 'loja{at}example.com',
      showcase_enabled: true,
      acknowledge_public_group_link: true,
    });
    expect(request).toHaveBeenCalledWith('/v1/store', {
      method: 'PATCH',
      body: {
        pix_key: 'loja{at}example.com',
        showcase_enabled: true,
        acknowledge_public_group_link: true,
      },
    });
  });

  it('lists the message templates, and sets or resets the text of one', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = createStoreApi({ request } as unknown as ApiClient);
    const signal = new AbortController().signal;

    await api.templates(signal);
    await api.setTemplate('card_opened', 'Hello {card}');
    await api.resetTemplate('auction_won');

    expect(request).toHaveBeenNthCalledWith(1, '/v1/store/message-templates', { signal });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/store/message-templates/card_opened', {
      method: 'PUT',
      body: { body: 'Hello {card}' },
    });
    expect(request).toHaveBeenNthCalledWith(3, '/v1/store/message-templates/auction_won', {
      method: 'DELETE',
    });
  });
});
