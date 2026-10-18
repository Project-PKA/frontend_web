import type { paths } from './generated';
import type { ApiClient } from './client';

type JsonBody<Path extends keyof paths, Status extends number> = paths[Path] extends {
  get: { responses: Record<Status, { content: { 'application/json': infer Body } }> };
}
  ? Body
  : never;

/** `GET /v1/me`: who is logged in and what the platform lets them do. */
export type Me = JsonBody<'/v1/me', 200>;
/** `GET /v1/store`: the current store with the role and permissions of the person. */
export type CurrentStore = JsonBody<'/v1/store', 200>;

export function createAccessApi(client: ApiClient) {
  return {
    getMe: () => client.request<Me>('/v1/me'),
    /** Sends `x-store-id` from the client, so the store must be chosen first. */
    getStore: () => client.request<CurrentStore>('/v1/store'),
  };
}

export type AccessApi = ReturnType<typeof createAccessApi>;
