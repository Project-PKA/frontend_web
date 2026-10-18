import type { operations } from './generated';
import type { ApiClient } from './client';

type JsonOk<Operation extends keyof operations> = operations[Operation] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;

/** `GET /v1/me/preferences`: language, theme, time zone, currency and notifications. */
export type Preferences = JsonOk<'getPreferences'>;

export type PreferencesUpdate = operations['updatePreferences']['requestBody'] extends {
  content: { 'application/json': infer Body };
}
  ? Body
  : never;

export function createPreferencesApi(client: ApiClient) {
  return {
    get: () => client.request<Preferences>('/v1/me/preferences'),
    /** Sends only what changed. */
    update: (changes: PreferencesUpdate) =>
      client.request<Preferences>('/v1/me/preferences', { method: 'PATCH', body: changes }),
  };
}

export type PreferencesApi = ReturnType<typeof createPreferencesApi>;
