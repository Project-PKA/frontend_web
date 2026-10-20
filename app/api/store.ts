import type { ApiClient } from './client';

export function createStoreApi(client: ApiClient) {
  return {
    /**
     * Days without interaction until the bot removes a member from the group; `null` turns it off.
     * Needs the owner: the API answers 403 otherwise.
     */
    setInactivityLimit: (days: number | null) =>
      client.request<unknown>('/v1/store', {
        method: 'PATCH',
        body: { inactivity_days_limit: days },
      }),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;
