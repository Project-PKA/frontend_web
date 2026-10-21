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

/** `GET /v1/admin/users`: the accounts of the platform. */
export type UserPage = JsonBody<'/v1/admin/users'>;
export type AdminUser = UserPage['items'][number];
/** `GET /v1/admin/users/{id}`: one account with the stores it belongs to (read only). */
export type AdminUserDetail = AdminUser & {
  stores: { id: string; name: string; role: 'OWNER' | 'STAFF' }[];
};
export type UserStatus = AdminUser['status'];
/** What `POST /v1/admin/users` takes: the account is created by invitation. */
export interface NewUser {
  email: string;
  name?: string;
  can_create_stores?: boolean;
  store_limit?: number;
}
/** What `PATCH /v1/admin/users/{id}/permissions` takes: only what changed. */
export interface UserPermissions {
  can_create_stores?: boolean;
  store_limit?: number;
}
export interface UserFilters {
  q?: string;
  status?: UserStatus;
  can_create_stores?: boolean;
}
/** `GET /v1/admin/invitations`: invitations of any kind, in any store. */
export type AdminInvitationPage = JsonBody<'/v1/admin/invitations'>;
export type AdminInvitation = AdminInvitationPage['items'][number];

const PAGE_SIZE = 20;
/** The biggest page of the invitations, and how many pages are read to find one. */
const INVITATION_PAGE = 100;
const INVITATION_PAGES = 10;

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
    users: (filters: UserFilters, cursor?: string, signal?: AbortSignal) =>
      client.request<UserPage>('/v1/admin/users', {
        query: { ...filters, cursor, limit: PAGE_SIZE },
        signal,
      }),
    user: (id: string, signal?: AbortSignal) =>
      client.request<AdminUserDetail>(`/v1/admin/users/${encodeURIComponent(id)}`, { signal }),
    /** Creates the account and sends the invitation by e-mail. */
    createUser: (user: NewUser) =>
      client.request<AdminUser>('/v1/admin/users', { method: 'POST', body: user }),
    updatePermissions: (id: string, changes: UserPermissions) =>
      client.request<AdminUser>(`/v1/admin/users/${encodeURIComponent(id)}/permissions`, {
        method: 'PATCH',
        body: changes,
      }),
    /** Blocks the login in every store, without deleting anything. */
    suspend: (id: string) =>
      client.request<AdminUser>(`/v1/admin/users/${encodeURIComponent(id)}/suspend`, {
        method: 'POST',
        body: {},
      }),
    reactivate: (id: string) =>
      client.request<AdminUser>(`/v1/admin/users/${encodeURIComponent(id)}/reactivate`, {
        method: 'POST',
        body: {},
      }),
    /** A new token: the link of the previous e-mail stops working. */
    resendInvitation: (id: string) =>
      client.request<unknown>(`/v1/admin/invitations/${encodeURIComponent(id)}/resend`, {
        method: 'POST',
        body: {},
      }),
    /**
     * The invitation of an account still waiting to be accepted. The list has no filter by e-mail,
     * so the pending account invitations are read, a page at a time, until the e-mail shows up.
     */
    async findPendingAccountInvitation(email: string): Promise<AdminInvitation | null> {
      let cursor: string | undefined;
      for (let page = 0; page < INVITATION_PAGES; page += 1) {
        const result = await client.request<AdminInvitationPage>('/v1/admin/invitations', {
          query: { kind: 'ACCOUNT', status: 'PENDING', cursor, limit: INVITATION_PAGE },
        });
        const found = result.items.find((item) => item.email.toLowerCase() === email.toLowerCase());
        if (found) return found;
        if (!result.next_cursor) return null;
        cursor = result.next_cursor;
      }
      return null;
    },
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
