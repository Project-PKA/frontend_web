import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createInvitationsApi } from './invitations';

function setup() {
  const request = vi.fn().mockResolvedValue({});
  return { request, api: createInvitationsApi({ request } as unknown as ApiClient) };
}

describe('invitations api', () => {
  it('previews an invitation by its token, without the session', async () => {
    const { api, request } = setup();

    await api.preview('t'.repeat(30));

    expect(request).toHaveBeenCalledWith('/v1/auth/invitations/preview', {
      method: 'POST',
      body: { token: 't'.repeat(30) },
      anonymous: true,
    });
  });

  it('accepts an invitation by its token, in the body and not in the URL', async () => {
    const { api, request } = setup();

    await api.accept('t'.repeat(30));

    const [path, options] = request.mock.calls[0] as [
      string,
      { body: unknown; anonymous: boolean },
    ];
    expect(path).toBe('/v1/auth/invitations/accept');
    expect(path).not.toContain('ttt');
    expect(options).toMatchObject({
      method: 'POST',
      body: { token: 't'.repeat(30) },
      anonymous: true,
    });
  });
});
