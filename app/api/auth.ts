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

/** Response of `POST /v1/auth/otp/verify` and `POST /v1/auth/refresh`. */
export type SessionPayload = JsonBody<'/v1/auth/otp/verify', 'post', 200>;
export type SessionUser = SessionPayload['user'];
export type MySessions = JsonBody<'/v1/me/sessions', 'get', 200>;

export function createAuthApi(client: ApiClient) {
  return {
    /** The API answers the same way whether or not the e-mail has an account. */
    requestOtp: (email: string) =>
      client.request<JsonBody<'/v1/auth/otp/request', 'post', 202>>('/v1/auth/otp/request', {
        method: 'POST',
        body: { email },
        anonymous: true,
      }),

    verifyOtp: (email: string, code: string) =>
      client.request<SessionPayload>('/v1/auth/otp/verify', {
        method: 'POST',
        body: { email, code },
        anonymous: true,
        withCredentials: true,
      }),

    /** Uses the httpOnly refresh cookie; there is no body. */
    refresh: () =>
      client.request<SessionPayload>('/v1/auth/refresh', {
        method: 'POST',
        anonymous: true,
        withCredentials: true,
      }),

    logout: () =>
      client.request<undefined>('/v1/auth/logout', {
        method: 'POST',
        anonymous: true,
        withCredentials: true,
      }),

    listSessions: () => client.request<MySessions>('/v1/me/sessions'),

    revokeSession: (id: string) =>
      client.request<undefined>(`/v1/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
