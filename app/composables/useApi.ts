import { createApiClient } from '../api/client';

/**
 * The API client for authenticated calls: it sends the access token from the
 * session store and renews the session once after a 401. All network calls in
 * the app go through this client.
 */
export function useApi() {
  const { public: config } = useRuntimeConfig();
  const session = useSessionStore();

  return createApiClient({
    baseUrl: config.apiBaseUrl,
    getAccessToken: () => session.accessToken,
    getStoreId: () => null,
    refreshSession: () => session.refresh(),
  });
}
