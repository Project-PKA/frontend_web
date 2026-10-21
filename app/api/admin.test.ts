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

  it('lists the users with the filters and the cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await apiWith(request).users({ q: 'ana', status: 'ACTIVE', can_create_stores: true }, 'abc');
    expect(request).toHaveBeenCalledWith('/v1/admin/users', {
      query: { q: 'ana', status: 'ACTIVE', can_create_stores: true, cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('opens one user, creates one by invitation and changes the permissions', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = apiWith(request);
    await api.user('u/1');
    await api.createUser({ email: 'ana@example.com', can_create_stores: true, store_limit: 2 });
    await api.updatePermissions('u1', { store_limit: 3 });
    expect(request).toHaveBeenNthCalledWith(1, '/v1/admin/users/u%2F1', { signal: undefined });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/admin/users', {
      method: 'POST',
      body: { email: 'ana@example.com', can_create_stores: true, store_limit: 2 },
    });
    expect(request).toHaveBeenNthCalledWith(3, '/v1/admin/users/u1/permissions', {
      method: 'PATCH',
      body: { store_limit: 3 },
    });
  });

  it('suspends and reactivates', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = apiWith(request);
    await api.suspend('u1');
    await api.reactivate('u1');
    expect(request).toHaveBeenNthCalledWith(1, '/v1/admin/users/u1/suspend', {
      method: 'POST',
      body: {},
    });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/admin/users/u1/reactivate', {
      method: 'POST',
      body: {},
    });
  });

  it('resends an invitation', async () => {
    const request = vi.fn().mockResolvedValue({});
    await apiWith(request).resendInvitation('i1');
    expect(request).toHaveBeenCalledWith('/v1/admin/invitations/i1/resend', {
      method: 'POST',
      body: {},
    });
  });

  it('finds the pending invitation of an e-mail, reading the next page when needed', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'i1', email: 'other@example.com' }],
        next_cursor: 'p2',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'i2', email: 'Ana@Example.com' }],
        next_cursor: null,
      });
    const found = await apiWith(request).findPendingAccountInvitation('ana@example.com');
    expect(found).toMatchObject({ id: 'i2' });
    expect(request).toHaveBeenNthCalledWith(2, '/v1/admin/invitations', {
      query: { kind: 'ACCOUNT', status: 'PENDING', cursor: 'p2', limit: 100 },
    });
  });

  it('gives null when no pending invitation has that e-mail', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    expect(await apiWith(request).findPendingAccountInvitation('x@example.com')).toBeNull();
  });
});
