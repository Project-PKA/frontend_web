import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/plan`: the plan of the store with its limits, the usage and the change requests. */
export type PlanOverview = paths['/v1/plan']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type PlanRequest = NonNullable<PlanOverview['pending_request']>;

/** What the owner asks for: both are optional, but at least one must come. */
export interface PlanChange {
  /** The code of the plan (`STANDARD`): capital letters, digits and `_`, 2 to 20 characters. */
  requested_plan?: string;
  message?: string;
}

/**
 * The plan is a label with limits (no billing in the MVP, decision D6), and changing it is a
 * request to the administration: there is no self-service.
 */
export function createPlanApi(client: ApiClient) {
  return {
    overview: (signal?: AbortSignal) => client.request<PlanOverview>('/v1/plan', { signal }),
    /** Asking again updates the request that is waiting in the queue. */
    requestChange: (change: PlanChange) =>
      client.request<PlanRequest>('/v1/plan/change-requests', { method: 'POST', body: change }),
  };
}

export type PlanApi = ReturnType<typeof createPlanApi>;
