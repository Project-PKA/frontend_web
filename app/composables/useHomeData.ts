import { useQuery } from '@tanstack/vue-query';
import { createDashboardApi, type HomeDashboard } from '../api/dashboard';

/** How often each component of the home asks again while it is on screen (the tab visible). */
export const HOME_REFRESH_MS = 15_000;

/**
 * One piece of the live home. Every component of the home calls this with its own `select`, so
 * each one polls and updates by itself and the page does not. They share one query key, so the
 * API is still asked once per round, not once per component; and because the result of `select`
 * keeps its identity when its content did not change, a component whose piece did not change is
 * not touched when another one's did.
 */
export function useHomeData<Piece>(select: (home: HomeDashboard) => Piece) {
  const access = useAccessStore();
  const api = createDashboardApi(useApi());

  return useQuery({
    queryKey: computed(() => ['home', access.storeId]),
    queryFn: ({ signal }) => api.home(signal),
    refetchInterval: HOME_REFRESH_MS,
    select,
  });
}
