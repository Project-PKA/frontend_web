import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthApi, SessionPayload } from '../api/auth';
import { ApiError } from '../api/errors';
import { defineSessionStore } from './session';

function payload(token = 'access-1'): SessionPayload {
  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: 900,
    user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
  };
}

function rejected(code: string) {
  return vi.fn().mockRejectedValue(new ApiError('http', { status: 401, code }));
}

function fakeApi(overrides: Partial<Record<keyof AuthApi, unknown>> = {}) {
  const api = {
    requestOtp: vi.fn().mockResolvedValue({ status: 'accepted' }),
    verifyOtp: vi.fn().mockResolvedValue(payload()),
    refresh: vi.fn().mockResolvedValue(payload('access-2')),
    logout: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn(),
    revokeSession: vi.fn(),
    ...overrides,
  };
  return api as unknown as AuthApi & Record<keyof AuthApi, ReturnType<typeof vi.fn>>;
}

function setup(api: AuthApi) {
  setActivePinia(createPinia());
  return defineSessionStore(() => api)();
}

describe('session store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts without a session', () => {
    const session = setup(fakeApi());
    expect(session.status).toBe('unknown');
    expect(session.accessToken).toBeNull();
    expect(session.isAuthenticated).toBe(false);
  });

  it('logs in with the e-mail and the code', async () => {
    const api = fakeApi();
    const session = setup(api);

    await session.login('igor@example.com', '123456');

    expect(api.verifyOtp).toHaveBeenCalledWith('igor@example.com', '123456');
    expect(session.isAuthenticated).toBe(true);
    expect(session.accessToken).toBe('access-1');
    expect(session.user?.email).toBe('igor@example.com');
  });

  it('keeps the session closed when the code is wrong', async () => {
    const session = setup(fakeApi({ verifyOtp: rejected('INVALID_CODE') }));

    await expect(session.login('igor@example.com', '000000')).rejects.toMatchObject({
      code: 'INVALID_CODE',
    });
    expect(session.isAuthenticated).toBe(false);
  });

  it('requests the code through the API', async () => {
    const api = fakeApi();
    await setup(api).requestOtp('igor@example.com');
    expect(api.requestOtp).toHaveBeenCalledWith('igor@example.com');
  });

  it('shares one refresh request between concurrent callers', async () => {
    const api = fakeApi();
    const session = setup(api);

    const results = await Promise.all([session.refresh(), session.refresh(), session.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(session.accessToken).toBe('access-2');
  });

  it('can refresh again after a refresh finished', async () => {
    const api = fakeApi();
    const session = setup(api);
    await session.refresh();
    await session.refresh();
    expect(api.refresh).toHaveBeenCalledTimes(2);
  });

  it('ends the session when the refresh is rejected', async () => {
    const session = setup(fakeApi({ refresh: rejected('INVALID_REFRESH') }));
    await session.login('igor@example.com', '123456');

    expect(await session.refresh()).toBe(false);
    expect(session.status).toBe('anonymous');
    expect(session.accessToken).toBeNull();
  });

  it('keeps the session when the refresh fails because of the network', async () => {
    const network = vi.fn().mockRejectedValue(new ApiError('network'));
    const session = setup(fakeApi({ refresh: network }));
    await session.login('igor@example.com', '123456');

    expect(await session.refresh()).toBe(false);
    expect(session.isAuthenticated).toBe(true);
    expect(session.accessToken).toBe('access-1');
  });

  it('restores the session once from the refresh cookie', async () => {
    const api = fakeApi();
    const session = setup(api);

    await session.restore();
    await session.restore();

    expect(session.isAuthenticated).toBe(true);
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('becomes anonymous when there is nothing to restore', async () => {
    const session = setup(fakeApi({ refresh: rejected('INVALID_REFRESH') }));
    await session.restore();
    expect(session.status).toBe('anonymous');
  });

  it('becomes anonymous after a restore that could not reach the server', async () => {
    const network = vi.fn().mockRejectedValue(new ApiError('network'));
    const session = setup(fakeApi({ refresh: network }));
    await session.restore();
    expect(session.status).toBe('anonymous');
  });

  it('logs out and clears the token even if the server cannot be reached', async () => {
    const unreachable = vi.fn().mockRejectedValue(new ApiError('network'));
    const api = fakeApi({ logout: unreachable });
    const session = setup(api);
    await session.login('igor@example.com', '123456');

    await session.logout();

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(session.status).toBe('anonymous');
    expect(session.accessToken).toBeNull();
    expect(session.user).toBeNull();
  });
});
