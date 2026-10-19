import type { paths } from './generated';
import type { ApiClient } from './client';

export type AccessRequestBody = paths['/v1/public/access-requests']['post']['requestBody'] extends {
  content: { 'application/json': infer Body };
}
  ? Body
  : never;

export function createAccessRequestsApi(client: ApiClient) {
  return {
    /**
     * Asks for access. It creates no user and no store and sends no e-mail: the platform
     * administration decides later. The answer is the same for a new, a repeated and a
     * discarded request, so it says nothing about who already asked.
     */
    request: (body: AccessRequestBody) =>
      client.request<{ status: 'RECEIVED' }>('/v1/public/access-requests', {
        method: 'POST',
        body,
        anonymous: true,
      }),
  };
}

export type AccessRequestsApi = ReturnType<typeof createAccessRequestsApi>;
