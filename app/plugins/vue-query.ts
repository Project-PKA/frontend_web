import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { shouldRetry } from '../utils/query-retry';

/**
 * The server-state cache (TanStack Query). It holds data of one person and one store,
 * so it is emptied when the session ends and when another store is chosen.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: shouldRetry },
    },
  });
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });

  if (import.meta.client) {
    const session = useSessionStore();
    const access = useAccessStore();
    watch(
      () => session.status,
      (status) => {
        if (status === 'anonymous') queryClient.clear();
      },
    );
    watch(
      () => access.storeId,
      () => queryClient.clear(),
    );
  }
});
