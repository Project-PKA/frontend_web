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
> = paths[Path][Method] extends {
  requestBody: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;

/** `GET /v1/customers`: the store's customers and visitors, with filters. */
export type CustomerPage = JsonBody<'/v1/customers', 'get', 200>;
export type Customer = CustomerPage['items'][number];
/** `GET /v1/customers/{id}`: one customer. */
export type CustomerDetail = JsonBody<'/v1/customers/{id}', 'get', 200>;
/** The body of `POST /v1/customers` and of `PATCH /v1/customers/{id}`. */
export type NewCustomer = JsonRequest<'/v1/customers', 'post'>;
export type CustomerChanges = JsonRequest<'/v1/customers/{id}', 'patch'>;
export type CustomerAddress = NonNullable<CustomerChanges['address']>;
/** `GET /v1/customers/{id}/settlements` and `/bids`: what a customer owes and what they bid. */
export type CustomerSettlementPage = JsonBody<'/v1/customers/{id}/settlements', 'get', 200>;
export type CustomerSettlement = CustomerSettlementPage['items'][number];
export type CustomerBidPage = JsonBody<'/v1/customers/{id}/bids', 'get', 200>;
export type CustomerBid = CustomerBidPage['items'][number];
/** `POST /v1/customers/{id}/consignor-link`: the link is built with the token, which shows only once. */
export type ConsignorLink = JsonBody<'/v1/customers/{id}/consignor-link', 'post', 201>;

export const CUSTOMER_KINDS = ['VISITOR', 'CUSTOMER'] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export interface CustomerFilters {
  q?: string;
  kind?: CustomerKind;
  consignor?: boolean;
  blacklisted?: boolean;
  inactive?: boolean;
}

const PAGE_SIZE = 20;

export function createCustomersApi(client: ApiClient) {
  return {
    list: (filters: CustomerFilters, cursor?: string, signal?: AbortSignal) =>
      client.request<CustomerPage>('/v1/customers', {
        query: { ...filters, cursor, limit: PAGE_SIZE },
        signal,
      }),
    get: (id: string, signal?: AbortSignal) =>
      client.request<CustomerDetail>(`/v1/customers/${encodeURIComponent(id)}`, { signal }),
    create: (customer: NewCustomer) =>
      client.request<CustomerDetail>('/v1/customers', { method: 'POST', body: customer }),
    /** Only what changed: the API changes only what it receives. The CPF is written, never read back. */
    update: (id: string, changes: CustomerChanges) =>
      client.request<CustomerDetail>(`/v1/customers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: changes,
      }),
    /** Blocks the number from new auctions (and the bot removes it from the group). */
    blacklist: (id: string, reason: string) =>
      client.request<CustomerDetail>(`/v1/customers/${encodeURIComponent(id)}/blacklist`, {
        method: 'POST',
        body: { reason },
      }),
    unblacklist: (id: string) =>
      client.request<CustomerDetail>(`/v1/customers/${encodeURIComponent(id)}/blacklist`, {
        method: 'DELETE',
      }),
    settlements: (id: string, cursor?: string, signal?: AbortSignal) =>
      client.request<CustomerSettlementPage>(
        `/v1/customers/${encodeURIComponent(id)}/settlements`,
        { query: { cursor, limit: PAGE_SIZE }, signal },
      ),
    bids: (id: string, cursor?: string, signal?: AbortSignal) =>
      client.request<CustomerBidPage>(`/v1/customers/${encodeURIComponent(id)}/bids`, {
        query: { cursor, limit: PAGE_SIZE },
        signal,
      }),
    /** By name, phone or CPF; a short list, enough to pick one. */
    search: (q: string, signal?: AbortSignal) =>
      client.request<CustomerPage>('/v1/customers', { query: { q, limit: 8 }, signal }),
    /** Needs the CPF registered: the first 4 digits are the key to open the link. */
    createConsignorLink: (customerId: string) =>
      client.request<ConsignorLink>(
        `/v1/customers/${encodeURIComponent(customerId)}/consignor-link`,
        { method: 'POST', body: {} },
      ),
  };
}

export type CustomersApi = ReturnType<typeof createCustomersApi>;
