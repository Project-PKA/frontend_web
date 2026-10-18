import { describe, expect, it, vi } from 'vitest';
import { createAuthApi } from './auth';
import type { ApiClient, RequestOptions } from './client';

function setup(result: unknown = {}) {
  const request = vi.fn().mockResolvedValue(result);
  const api = createAuthApi({ request } as unknown as ApiClient);
  const lastCall = (): [string, RequestOptions] =>
    request.mock.calls.at(-1) as [string, RequestOptions];
  return { api, request, lastCall };
}

describe('auth api', () => {
  it('asks for a code without credentials', async () => {
    const { api, lastCall } = setup({ status: 'accepted' });

    await api.requestOtp('igor@example.com');

    expect(lastCall()).toEqual([
      '/v1/auth/otp/request',
      { method: 'POST', body: { email: 'igor@example.com' }, anonymous: true },
    ]);
  });

  it('verifies the code and receives the refresh cookie', async () => {
    const { api, lastCall } = setup();

    await api.verifyOtp('igor@example.com', '123456');

    expect(lastCall()).toEqual([
      '/v1/auth/otp/verify',
      {
        method: 'POST',
        body: { email: 'igor@example.com', code: '123456' },
        anonymous: true,
        withCredentials: true,
      },
    ]);
  });

  it('refreshes with the cookie and no body', async () => {
    const { api, lastCall } = setup();

    await api.refresh();

    expect(lastCall()).toEqual([
      '/v1/auth/refresh',
      { method: 'POST', anonymous: true, withCredentials: true },
    ]);
  });

  it('logs out with the cookie', async () => {
    const { api, lastCall } = setup();

    await api.logout();

    expect(lastCall()).toEqual([
      '/v1/auth/logout',
      { method: 'POST', anonymous: true, withCredentials: true },
    ]);
  });

  it('lists the sessions of the person', async () => {
    const { api, lastCall } = setup({ items: [] });

    await api.listSessions();

    expect(lastCall()).toEqual(['/v1/me/sessions']);
  });

  it('revokes a session by id, encoding the id', async () => {
    const { api, lastCall } = setup();

    await api.revokeSession('a/b');

    expect(lastCall()).toEqual(['/v1/me/sessions/a%2Fb', { method: 'DELETE' }]);
  });
});
