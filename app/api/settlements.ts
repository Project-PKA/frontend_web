import type { paths } from './generated';
import type { ApiClient } from './client';

/** `POST /v1/settlements/{id}/paid`: the settlement with its items and who it belongs to. */
export type PaidSettlement =
  paths['/v1/settlements/{id}/paid']['post']['responses'][200]['content']['application/json'];

export function createSettlementsApi(client: ApiClient) {
  return {
    /** Only the store confirms a payment (never the buyer); the cards become sold. */
    markPaid: (id: string) =>
      client.request<PaidSettlement>(`/v1/settlements/${encodeURIComponent(id)}/paid`, {
        method: 'POST',
        body: {},
      }),
  };
}
