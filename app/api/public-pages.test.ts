import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createPublicPagesApi } from './public-pages';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createPublicPagesApi({ request } as unknown as ApiClient);
}

describe('public pages api', () => {
  it('opens the settlement with the token in the body, without a session', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).settlement('tok');
    expect(request).toHaveBeenCalledWith('/v1/public/settlement', {
      method: 'POST',
      body: { token: 'tok' },
      anonymous: true,
    });
  });

  it('sends the data of the buyer with the token', async () => {
    const request = vi.fn().mockResolvedValue({ result: 'OK' });
    const data = {
      cpf: '52998224725',
      address: {
        zip: '01310100',
        street: 'Rua A',
        number: '10',
        comp: null,
        city: 'SP',
        state: 'SP',
      },
      consent: { accepted: true, version: 'v1' },
    };
    await apiWith(request).submitBuyerData('tok', data);
    expect(request).toHaveBeenCalledWith('/v1/public/settlement/data', {
      method: 'POST',
      body: { token: 'tok', ...data },
      anonymous: true,
    });
  });

  it('warns the store that the buyer paid', async () => {
    const request = vi.fn().mockResolvedValue({ result: 'OK' });
    await apiWith(request).claimPaid('tok');
    expect(request).toHaveBeenCalledWith('/v1/public/settlement/paid', {
      method: 'POST',
      body: { token: 'tok' },
      anonymous: true,
    });
  });

  it('opens the page of the consignor with the token and the key', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).consignor('tok', '5299');
    expect(request).toHaveBeenCalledWith('/v1/public/consignor', {
      method: 'POST',
      body: { token: 'tok', key: '5299' },
      anonymous: true,
    });
  });
});
