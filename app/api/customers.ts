import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/customers`: the store's customers and visitors, with filters. */
export type CustomerPage = paths['/v1/customers']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type Customer = CustomerPage['items'][number];
/** `POST /v1/customers/{id}/consignor-link`: the link is built with the token, which shows only once. */
export type ConsignorLink = paths['/v1/customers/{id}/consignor-link']['post'] extends {
  responses: { 201: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;

export function createCustomersApi(client: ApiClient) {
  return {
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
