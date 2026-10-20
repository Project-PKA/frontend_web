import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/auctions`: the auctions of the store, newest first. */
export type AuctionPage = paths['/v1/auctions']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type Auction = AuctionPage['items'][number];
/** `GET /v1/auctions/{id}`: one auction with its bids. */
export type AuctionDetail = paths['/v1/auctions/{id}']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;

type JsonRequest<Path extends keyof paths, Method extends 'post' | 'patch'> = paths[Path] extends {
  [M in Method]: { requestBody: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
/** The body of `POST /v1/auctions`: money as decimal strings, `start_time` left out to start now. */
export type CreateAuction = JsonRequest<'/v1/auctions', 'post'>;
/** The body of `PATCH /v1/auctions/{id}`: only what changes. */
export type UpdateAuction = JsonRequest<'/v1/auctions/{id}', 'patch'>;

export const AUCTION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'PAUSED_FOR_VALIDATION',
  'FINISHED',
  'CANCELLED',
] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];
export const AUCTION_TYPES = ['FREE_BID', 'POLL'] as const;
export type AuctionType = (typeof AUCTION_TYPES)[number];

const PAGE_SIZE = 20;

export function createAuctionsApi(client: ApiClient) {
  return {
    list: (status: AuctionStatus, cursor?: string, signal?: AbortSignal) =>
      client.request<AuctionPage>('/v1/auctions', {
        query: { status, cursor, limit: PAGE_SIZE },
        signal,
      }),
    get: (id: string, signal?: AbortSignal) =>
      client.request<AuctionDetail>(`/v1/auctions/${encodeURIComponent(id)}`, { signal }),
    create: (auction: CreateAuction) =>
      client.request<Auction>('/v1/auctions', { method: 'POST', body: auction }),
    update: (id: string, changes: UpdateAuction) =>
      client.request<Auction>(`/v1/auctions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: changes,
      }),
    /** Pushes the end of a running auction later by some minutes (1 to 1440). */
    extend: (id: string, minutes: number) =>
      client.request<{ extended: string[] }>(`/v1/auctions/${encodeURIComponent(id)}/extend`, {
        method: 'POST',
        body: { minutes },
      }),
    cancel: (id: string) =>
      client.request<Auction>(`/v1/auctions/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  };
}

export type AuctionsApi = ReturnType<typeof createAuctionsApi>;
