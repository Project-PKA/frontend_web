import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createNotificationsApi } from './notifications';
import { createTeamApi } from './team';

function apiWith(request: ReturnType<typeof vi.fn>) {
  return { request } as unknown as ApiClient;
}

describe('notifications api', () => {
  it('lists a page, asking from the cursor when there is one', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    const api = createNotificationsApi(apiWith(request));

    await api.list('abc');

    expect(request).toHaveBeenCalledWith('/v1/notifications', {
      query: { cursor: 'abc', limit: 20 },
      signal: undefined,
    });
  });

  it('counts the unread ones', async () => {
    const request = vi.fn().mockResolvedValue({ count: 3 });
    await createNotificationsApi(apiWith(request)).unreadCount();
    expect(request).toHaveBeenCalledWith('/v1/notifications/unread-count', { signal: undefined });
  });

  it('marks one as read by its id, safely encoded', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    await createNotificationsApi(apiWith(request)).markRead('a/b');
    expect(request).toHaveBeenCalledWith('/v1/notifications/a%2Fb/read', { method: 'POST' });
  });

  it('marks all as read', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    await createNotificationsApi(apiWith(request)).markAllRead();
    expect(request).toHaveBeenCalledWith('/v1/notifications/read-all', { method: 'POST' });
  });

  it('lists the activity log by cursor', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await createNotificationsApi(apiWith(request)).activityLog();
    expect(request).toHaveBeenCalledWith('/v1/activity-log', {
      query: { cursor: undefined, limit: 20 },
      signal: undefined,
    });
  });
});

describe('team api', () => {
  it('asks for the biggest page', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], next_cursor: null });
    await createTeamApi(apiWith(request)).list();
    expect(request).toHaveBeenCalledWith('/v1/team', { query: { limit: 100 }, signal: undefined });
  });
});
