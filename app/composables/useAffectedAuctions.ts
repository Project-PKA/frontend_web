import { useQuery } from '@tanstack/vue-query';
import { createAuctionsApi } from '../api/auctions';

/** How often the screen looks again at the connection and at the auctions it hurts. */
const REFRESH_MS = 15_000;

/**
 * The state of the store's WhatsApp and the running auctions hit by it (`/v1/auctions/affected`):
 * the Home and the outage page ask the same question, so they share the answer. A failure is not
 * worth a message on the Home (it just shows no alert), so it does not retry.
 */
export function useAffectedAuctions() {
  const access = useAccessStore();
  const api = createAuctionsApi(useApi());

  return useQuery({
    queryKey: computed(() => ['affected', access.storeId]),
    queryFn: ({ signal }) => api.affected(signal),
    enabled: computed(() => access.storeId !== null),
    refetchInterval: REFRESH_MS,
    retry: false,
  });
}
