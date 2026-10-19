import { useQuery } from '@tanstack/vue-query';
import { createNotificationsApi } from '../api/notifications';

/** How often the bell looks for new notices while the app is open. */
const REFRESH_MS = 60_000;

/**
 * How many notices of the current store the person has not read: the number on the bell.
 * A failure is not worth a message here (the bell just shows no number), so it does not retry.
 */
export function useUnreadCount() {
  const access = useAccessStore();
  const api = createNotificationsApi(useApi());

  const query = useQuery({
    queryKey: computed(() => ['unread-count', access.storeId]),
    queryFn: ({ signal }) => api.unreadCount(signal),
    enabled: computed(() => access.storeId !== null),
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  return computed(() => query.data.value?.count ?? 0);
}
