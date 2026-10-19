import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/cards`: the stock of the store, with filters. */
export type CardPage = paths['/v1/cards']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type CardItem = CardPage['items'][number];
/** `GET /v1/cards/{id}`: one card with its auctions. */
export type CardDetail = paths['/v1/cards/{id}']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;

export const CARD_STATUSES = ['AVAILABLE', 'SCHEDULED', 'AWAITING_CONFIRMATION', 'SOLD'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];
export const CARD_ORIGINS = ['OWN', 'CONSIGNED'] as const;
export type CardOrigin = (typeof CARD_ORIGINS)[number];

export interface CardFilters {
  q?: string;
  status?: CardStatus;
  origin?: CardOrigin;
}

const PAGE_SIZE = 20;

export function createInventoryApi(client: ApiClient) {
  return {
    list: (filters: CardFilters, cursor?: string, signal?: AbortSignal) =>
      client.request<CardPage>('/v1/cards', {
        query: { ...filters, cursor, limit: PAGE_SIZE },
        signal,
      }),
    get: (id: string, signal?: AbortSignal) =>
      client.request<CardDetail>(`/v1/cards/${encodeURIComponent(id)}`, { signal }),
    /** Only an available card that never went to an auction can be deleted. */
    remove: (id: string) =>
      client.request<undefined>(`/v1/cards/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** The photo needs the login, so it comes as a file through the client, not as an `<img src>`. */
    photo: (cardId: string, photoId: string, signal?: AbortSignal) =>
      client.request<Blob>(
        `/v1/cards/${encodeURIComponent(cardId)}/photos/${encodeURIComponent(photoId)}`,
        { parse: 'blob', signal },
      ),
  };
}

export type InventoryApi = ReturnType<typeof createInventoryApi>;
