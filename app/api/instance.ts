import { createApiClient } from './client';
import type { ApiError } from './errors';
import { forbiddenAction } from '../utils/forbidden';

interface AppClientOptions {
  getStoreId: () => string | null;
  /** The person is not allowed here: show the state, or pick the store again. */
  onForbidden: (action: ReturnType<typeof forbiddenAction>, error: ApiError) => void;
}

/**
 * The client for authenticated calls: sends the access token from the session
 * store and the current store, renews the session once after a 401, and maps a
 * 403 to the action the app takes.
 */
export function createAppClient(options: AppClientOptions) {
  const { public: config } = useRuntimeConfig();
  const session = useSessionStore();

  return createApiClient({
    baseUrl: config.apiBaseUrl,
    getAccessToken: () => session.accessToken,
    getStoreId: options.getStoreId,
    refreshSession: () => session.refresh(),
    onForbidden: (error) => options.onForbidden(forbiddenAction(error), error),
  });
}
