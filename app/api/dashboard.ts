import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/dashboard/home`: the live home of the store (no period, no ranking). */
export type HomeDashboard = paths['/v1/dashboard/home']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type HomeSetup = HomeDashboard['setup'];
export type PollAlert = HomeDashboard['poll_alerts'][number];
export type QuickSettlement = HomeDashboard['quick_settlements'][number];

export function createDashboardApi(client: ApiClient) {
  return {
    home: (signal?: AbortSignal) => client.request<HomeDashboard>('/v1/dashboard/home', { signal }),
  };
}

export type DashboardApi = ReturnType<typeof createDashboardApi>;
