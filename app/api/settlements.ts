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

/** `POST /v1/settlements/{id}/paid`: the settlement with its items and who it belongs to. */
export type PaidSettlement = JsonBody<'/v1/settlements/{id}/paid', 'post', 200>;
/** `GET /v1/settlements`: the settlements of the store. */
export type SettlementPage = JsonBody<'/v1/settlements', 'get', 200>;
export type Settlement = SettlementPage['items'][number];
export type SettlementStatus = Settlement['status'];
/** `GET /v1/settlements/awaiting`: buyers with auctions won and no settlement yet. */
export type AwaitingPage = JsonBody<'/v1/settlements/awaiting', 'get', 200>;
export type AwaitingBuyer = AwaitingPage['items'][number];
/** `POST /v1/settlements/{id}/public-link`: the link of the buyer; the token shows only once. */
export type SettlementLink = JsonBody<'/v1/settlements/{id}/public-link', 'post', 201>;

const PAGE_SIZE = 20;
/** How long the link of a settlement works, in days (the API default). */
export const LINK_DAYS = 14;

export function createSettlementsApi(client: ApiClient) {
  return {
    /** Only the store confirms a payment (never the buyer); the cards become sold. */
    markPaid: (id: string) =>
      client.request<PaidSettlement>(`/v1/settlements/${encodeURIComponent(id)}/paid`, {
        method: 'POST',
        body: {},
      }),
    list: (status: SettlementStatus, cursor?: string, signal?: AbortSignal) =>
      client.request<SettlementPage>('/v1/settlements', {
        query: { status, cursor, limit: PAGE_SIZE },
        signal,
      }),
    /** The buyers waiting for a settlement, with the auctions each one won. */
    awaiting: (signal?: AbortSignal) =>
      client.request<AwaitingPage>('/v1/settlements/awaiting', { signal }),
    /** The settlement of a buyer with the auctions they won; the total is the sum of the items. */
    create: (customerId: string, auctionIds: string[]) =>
      client.request<Settlement>('/v1/settlements', {
        method: 'POST',
        body: { customer_id: customerId, auction_ids: auctionIds },
      }),
    /** The image the buyer sent as the receipt (needs the login, so it comes as a file). */
    receipt: (id: string, signal?: AbortSignal) =>
      client.request<Blob>(`/v1/settlements/${encodeURIComponent(id)}/receipt`, {
        parse: 'blob',
        signal,
      }),
    /** A new link: the previous one stops working. */
    createLink: (id: string) =>
      client.request<SettlementLink>(`/v1/settlements/${encodeURIComponent(id)}/public-link`, {
        method: 'POST',
        body: { expires_in_days: LINK_DAYS },
      }),
  };
}

export type SettlementsApi = ReturnType<typeof createSettlementsApi>;
