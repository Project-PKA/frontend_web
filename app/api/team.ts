import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/team`: the people of the store, with their role. */
export type TeamPage = paths['/v1/team']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type TeamMember = TeamPage['items'][number];

export function createTeamApi(client: ApiClient) {
  return {
    /** The biggest page the API gives: enough to name the authors of the activity log. */
    list: (signal?: AbortSignal) =>
      client.request<TeamPage>('/v1/team', { query: { limit: 100 }, signal }),
  };
}

export type TeamApi = ReturnType<typeof createTeamApi>;
