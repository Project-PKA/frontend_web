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

/** `GET /v1/admin/stores`: every store, with its owner, plan, members and WhatsApp (no inner data). */
export type StorePage = JsonBody<'/v1/admin/stores'>;
export type AdminStore = StorePage['items'][number];
/** What `POST /v1/admin/stores` takes: the owner is an account (`owner_user_id`) or an e-mail. */
export interface NewStore {
  name: string;
  city?: string | null;
  plan?: string;
  member_limit?: number;
  card_limit?: number | null;
  owner_user_id?: string;
  owner_email?: string;
  /** Turns the access request into this store. */
  access_request_id?: string;
}
/** `MEMBER`: an active account became the owner. `INVITED`: a new e-mail got the invitation. */
export interface CreatedStore {
  store: AdminStore;
  owner_state: 'MEMBER' | 'INVITED';
}

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
    stores: (q: string | undefined, cursor?: string, signal?: AbortSignal) =>
      client.request<StorePage>('/v1/admin/stores', {
        query: { q, cursor, limit: PAGE_SIZE },
        signal,
      }),
    /** Creates the store and its owner: an active account becomes OWNER, a new e-mail is invited. */
    createStore: (store: NewStore) =>
      client.request<CreatedStore>('/v1/admin/stores', { method: 'POST', body: store }),
    /** The new owner takes over and the current one stays as an employee. */
    transferOwnership: (storeId: string, newOwnerUserId: string) =>
      client.request<AdminStore>(
        `/v1/admin/stores/${encodeURIComponent(storeId)}/transfer-ownership`,
        { method: 'POST', body: { new_owner_user_id: newOwnerUserId } },
      ),
    invitations: (
      query: { kind?: AdminInvitation['kind']; status?: AdminInvitation['state'] },
      cursor?: string,
      signal?: AbortSignal,
    ) =>
      client.request<AdminInvitationPage>('/v1/admin/invitations', {
        query: { ...query, cursor, limit: PAGE_SIZE },
        signal,
      }),
    /** The link of the invitation stops working right away. */
    revokeInvitation: (id: string) =>
      client.request<unknown>(`/v1/admin/invitations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    /** A page of the access requests of a status, by cursor (the dashboard asks for a short one). */
    accessRequestPage: (status: AccessRequestStatus, cursor?: string, signal?: AbortSignal) =>
      client.request<AccessRequestPage>('/v1/admin/access-requests', {
        query: { status, cursor, limit: PAGE_SIZE },
        signal,
      }),
    /** Refuses the request; nothing is sent to who asked. To approve, create the store from it. */
    refuseAccessRequest: (id: string) =>
      client.request<unknown>(`/v1/admin/access-requests/${encodeURIComponent(id)}/refuse`, {
        method: 'POST',
        body: {},
      }),
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
