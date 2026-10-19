import { createAppClient } from '../api/instance';

/**
 * The API client for authenticated calls. All network calls in the app go
 * through this client (see `createAppClient`).
 */
export function useApi() {
  const access = useAccessStore();

  return createAppClient({
    getStoreId: () => access.storeId,
    onForbidden: (action) => handleForbidden(action, () => access.clearStore()),
  });
}
