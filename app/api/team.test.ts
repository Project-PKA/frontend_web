import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createTeamApi } from './team';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return createTeamApi({ request } as unknown as ApiClient);
}

const choice = {
  can_manage_inventory: true,
  can_manage_auctions: false,
  can_manage_customers: true,
  can_view_finance: false,
  can_delete: false,
};

describe('team api', () => {
  it('lists the people and the invitations, the biggest page', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    const api = apiWith(request);
    await api.list();
    await api.invitations();
    expect(request).toHaveBeenNthCalledWith(1, '/v1/team', {
      query: { limit: 100 },
      signal: undefined,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/team/invitations', {
      query: { limit: 100 },
      signal: undefined,
    });
  });

  it('invites by e-mail with the chosen permissions', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).invite('ana@example.com', choice);
    expect(request).toHaveBeenCalledWith('/v1/team/invitations', {
      method: 'POST',
      body: { email: 'ana@example.com', permissions: choice },
    });
  });

  it('sends an invitation again and revokes it', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = apiWith(request);
    await api.resend('i/1');
    await api.revoke('i/1');
    expect(request).toHaveBeenNthCalledWith(1, '/v1/team/invitations/i%2F1/resend', {
      method: 'POST',
      body: {},
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/team/invitations/i%2F1', { method: 'DELETE' });
  });

  it('changes the permissions of a member and removes one', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = apiWith(request);
    await api.updatePermissions('m1', choice);
    await api.remove('m1');
    expect(request).toHaveBeenNthCalledWith(1, '/v1/team/m1', {
      method: 'PATCH',
      body: { permissions: choice },
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/team/m1', { method: 'DELETE' });
  });
});
