import type { paths } from './generated';
import type { ApiClient } from './client';

type JsonBody<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Status extends number,
> = paths[Path][Method] extends {
  responses: Record<Status, { content: { 'application/json': infer Body } }>;
}
  ? Body
  : never;

/** `POST /v1/auth/invitations/preview`: who is invited, to what, and with which permissions. */
export type InvitationPreview = JsonBody<'/v1/auth/invitations/preview', 'post', 200>;

export function createInvitationsApi(client: ApiClient) {
  return {
    /** Shows the invitation without accepting it. An invalid, expired or revoked token is the same 404. */
    preview: (token: string) =>
      client.request<InvitationPreview>('/v1/auth/invitations/preview', {
        method: 'POST',
        body: { token },
        anonymous: true,
      }),

    /** Accepts it. After that the person signs in with a code sent to their e-mail. */
    accept: (token: string) =>
      client.request<JsonBody<'/v1/auth/invitations/accept', 'post', 200>>(
        '/v1/auth/invitations/accept',
        { method: 'POST', body: { token }, anonymous: true },
      ),
  };
}

export type InvitationsApi = ReturnType<typeof createInvitationsApi>;
