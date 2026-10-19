import { createApiClient } from '../api/client';

/**
 * The API client for pages anyone can open (invitation, request access, and the public pages
 * by token): it sends no session and does not try to renew one.
 */
export function usePublicApi() {
  const { public: config } = useRuntimeConfig();

  return createApiClient({
    baseUrl: config.apiBaseUrl,
    getAccessToken: () => null,
    getStoreId: () => null,
    refreshSession: () => Promise.resolve(false),
  });
}
