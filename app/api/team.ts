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
type JsonRequest<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { requestBody: { content: { 'application/json': infer Body } } }
  ? Body
  : never;

/** `GET /v1/team`: the people of the store, with their role. */
export type TeamPage = JsonBody<'/v1/team', 'get', 200>;
export type TeamMember = TeamPage['items'][number];
/** `GET /v1/team/invitations`: the invitations of the store (owner only). */
export type InvitationPage = JsonBody<'/v1/team/invitations', 'get', 200>;
export type TeamInvitation = InvitationPage['items'][number];
/** The permissions the API lets the owner choose; the others it drops. */
export type PermissionChoice = NonNullable<
  JsonRequest<'/v1/team/invitations', 'post'>['permissions']
>;

const PAGE_SIZE = 100;

export function createTeamApi(client: ApiClient) {
  return {
    /** The biggest page the API gives: enough to name the authors of the activity log. */
    list: (signal?: AbortSignal) =>
      client.request<TeamPage>('/v1/team', { query: { limit: PAGE_SIZE }, signal }),
    invitations: (signal?: AbortSignal) =>
      client.request<InvitationPage>('/v1/team/invitations', {
        query: { limit: PAGE_SIZE },
        signal,
      }),
    /** The API sends the invitation by e-mail; the token never comes back to the screen. */
    invite: (email: string, permissions: PermissionChoice) =>
      client.request<JsonBody<'/v1/team/invitations', 'post', 201>>('/v1/team/invitations', {
        method: 'POST',
        body: { email, permissions },
      }),
    /** A new token: the link of the previous e-mail stops working. */
    resend: (id: string) =>
      client.request<unknown>(`/v1/team/invitations/${encodeURIComponent(id)}/resend`, {
        method: 'POST',
        body: {},
      }),
    revoke: (id: string) =>
      client.request<unknown>(`/v1/team/invitations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    updatePermissions: (id: string, permissions: PermissionChoice) =>
      client.request<TeamMember>(`/v1/team/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { permissions },
      }),
    remove: (id: string) =>
      client.request<unknown>(`/v1/team/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export type TeamApi = ReturnType<typeof createTeamApi>;
