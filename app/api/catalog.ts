import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/catalog/search`: cards of the catalog that match a name, a number or a set. */
export type CatalogSearchResult = paths['/v1/catalog/search']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type CatalogCard = CatalogSearchResult['items'][number];

export function createCatalogApi(client: ApiClient) {
  return {
    /** As-you-type: the API wants at least 2 characters (see `MIN_QUERY_LENGTH`). */
    search: (q: string, signal?: AbortSignal) =>
      client.request<CatalogSearchResult>('/v1/catalog/search', {
        query: { q, limit: 8 },
        signal,
      }),
  };
}

export type CatalogApi = ReturnType<typeof createCatalogApi>;
