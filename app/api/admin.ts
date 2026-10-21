import type { paths } from './generated';
import type { ApiClient } from './client';

type JsonBody<Path extends keyof paths> = paths[Path] extends {
  get: { responses: { 200: { content: { 'application/json': infer Body } } } };
}
  ? Body
  : never;

/** `GET /v1/admin/dashboard`: numbers of the platform and the stores with WhatsApp down. */
export type AdminDashboard = JsonBody<'/v1/admin/dashboard'>;
export type DisconnectedStore = AdminDashboard['disconnected_stores'][number];
/** `GET /v1/admin/access-requests`: who asked for access. */
export type AccessRequestPage = JsonBody<'/v1/admin/access-requests'>;
export type AccessRequest = AccessRequestPage['items'][number];
export type AccessRequestStatus = NonNullable<
  paths['/v1/admin/access-requests']['get']['parameters']['query']
>['status'];

/** How many requests the dashboard lists: the rest is in the invitations area. */
const DASHBOARD_REQUESTS = 5;

/**
 * Everything under `/v1/admin` is for the platform administrator, who does not see what is inside
 * the stores. These calls carry no `x-store-id`.
 */
export function createAdminApi(client: ApiClient) {
  return {
    dashboard: (signal?: AbortSignal) =>
      client.request<AdminDashboard>('/v1/admin/dashboard', { signal }),
    accessRequests: (
      status: AccessRequestStatus,
      limit = DASHBOARD_REQUESTS,
      signal?: AbortSignal,
    ) =>
      client.request<AccessRequestPage>('/v1/admin/access-requests', {
        query: { status, limit },
        signal,
      }),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
