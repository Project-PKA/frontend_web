import type { paths } from './generated';
import type { ApiClient } from './client';

type JsonBody<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Status extends number,
> = paths[Path][Method] extends {
  responses: Record<Status, { content: { 'application/json': infer Body } }>;
}
  ? Body
  : never;

/** `GET /v1/notifications`: the store's internal notices. The text is ours: the API sends a `kind` and ids. */
export type NotificationPage = JsonBody<'/v1/notifications', 'get', 200>;
export type NotificationItem = NotificationPage['items'][number];
/** `GET /v1/activity-log`: what the people of the store did (owner only). */
export type ActivityPage = JsonBody<'/v1/activity-log', 'get', 200>;
export type ActivityEntry = ActivityPage['items'][number];

const PAGE_SIZE = 20;

export function createNotificationsApi(client: ApiClient) {
  return {
    list: (cursor?: string, signal?: AbortSignal) =>
      client.request<NotificationPage>('/v1/notifications', {
        query: { cursor, limit: PAGE_SIZE },
        signal,
      }),
    unreadCount: (signal?: AbortSignal) =>
      client.request<{ count: number }>('/v1/notifications/unread-count', { signal }),
    markRead: (id: string) =>
      client.request<undefined>(`/v1/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
      }),
    markAllRead: () => client.request<undefined>('/v1/notifications/read-all', { method: 'POST' }),
    activityLog: (cursor?: string, signal?: AbortSignal) =>
      client.request<ActivityPage>('/v1/activity-log', {
        query: { cursor, limit: PAGE_SIZE },
        signal,
      }),
  };
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
