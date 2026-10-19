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

/** `GET /v1/me/stores`: the stores the person takes part in. */
export type MyStores = JsonBody<'/v1/me/stores', 'get', 200>;
export type MyStore = MyStores['items'][number];
/** `POST /v1/stores`. */
export type CreatedStore = JsonBody<'/v1/stores', 'post', 201>;

export function createStoresApi(client: ApiClient) {
  return {
    listMine: () => client.request<MyStores>('/v1/me/stores'),
    /** Needs the global permission to create stores and room under the limit. */
    create: (name: string) =>
      client.request<CreatedStore>('/v1/stores', { method: 'POST', body: { name } }),
  };
}

export type StoresApi = ReturnType<typeof createStoresApi>;
