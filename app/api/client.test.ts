import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError } from './errors';

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

function neverResolves(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) reject(signal.reason);
      signal?.addEventListener('abort', () => reject(signal.reason));
    })) as typeof fetch;
}

function makeClient(fetchImpl: typeof fetch, overrides: { refresh?: () => Promise<boolean> } = {}) {
  return createApiClient({
    baseUrl: 'https://api.example.com',
    getAccessToken: () => 'access-token',
    getStoreId: () => 'store-1',
    refreshSession: overrides.refresh ?? (() => Promise.resolve(false)),
    fetchImpl,
  });
}

describe('api client', () => {
  it('sends the bearer token and the store header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await makeClient(fetchImpl).request('/v1/store');

    const headers = fetchImpl.mock.calls[0]![1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('x-store-id')).toBe('store-1');
  });

  it('does not send credentials headers on anonymous requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    await makeClient(fetchImpl).request('/v1/public/settlement', {
      method: 'POST',
      body: { token: 'x' },
      anonymous: true,
    });

    const headers = fetchImpl.mock.calls[0]![1].headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('x-store-id')).toBeNull();
  });

  it('refreshes once after a 401 and repeats the request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ code: 'AUTH_TOKEN_EXPIRED' }, 401, 'application/problem+json'),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const refresh = vi.fn().mockResolvedValue(true);

    const result = await makeClient(fetchImpl, { refresh }).request('/v1/store');

    expect(result).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('exposes the stable code of a problem+json error and never the detail', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { code: 'BID_BID_TOO_LOW', detail: 'texto em português' },
          409,
          'application/problem+json',
        ),
      );

    const error = await makeClient(fetchImpl)
      .request('/v1/bids')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'BID_BID_TOO_LOW' });
    expect((error as ApiError).message).not.toContain('português');
  });

  it('builds the query string and skips undefined values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    await makeClient(fetchImpl).request('/v1/cards', { query: { limit: 20, cursor: undefined } });

    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.example.com/v1/cards?limit=20');
  });

  it('sends cookies only when asked to', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = makeClient(fetchImpl);
    await client.request('/v1/auth/refresh', { method: 'POST', withCredentials: true });
    await client.request('/v1/store');

    expect(fetchImpl.mock.calls[0]![1].credentials).toBe('include');
    expect(fetchImpl.mock.calls[1]![1].credentials).toBe('same-origin');
  });

  it('returns undefined for 204 responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await makeClient(fetchImpl).request('/v1/me/sessions/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('keeps the error status when the body is not a problem document', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const error = await makeClient(fetchImpl)
      .request('/v1/store')
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'http', status: 502, code: null });
  });

  it('does not refresh when the refresh fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'AUTH_UNAUTHENTICATED' }, 401));
    const error = await makeClient(fetchImpl)
      .request('/v1/store')
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'http', status: 401, code: 'AUTH_UNAUTHENTICATED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh anonymous requests', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'PUBLIC_LINK_NOT_FOUND' }, 404));
    const refresh = vi.fn().mockResolvedValue(true);
    await makeClient(fetchImpl, { refresh })
      .request('/v1/public/settlement', { anonymous: true })
      .catch(() => undefined);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports an aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await makeClient(neverResolves())
      .request('/v1/store', { signal: controller.signal })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'aborted' });
  });

  it('reports a timeout', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      getAccessToken: () => null,
      getStoreId: () => null,
      refreshSession: () => Promise.resolve(false),
      timeoutMs: 5,
      fetchImpl: neverResolves(),
    });
    const error = await client.request('/v1/store').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'timeout' });
  });

  it('reports a network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    const error = await makeClient(fetchImpl)
      .request('/v1/store')
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'network' });
  });

  it('reports a body that is not valid JSON as a parse failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    const error = await makeClient(fetchImpl)
      .request('/v1/store')
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: 'parse' });
  });
});
