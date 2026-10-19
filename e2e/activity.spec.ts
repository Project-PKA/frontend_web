import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';

function notice(n: number, kind: string, read = false) {
  return {
    id: `n-${n}`,
    kind,
    data: {},
    read,
    created_at: `2026-10-1${n}T12:00:00Z`,
  };
}

interface Options {
  role?: 'OWNER' | 'STAFF';
  notices?: ReturnType<typeof notice>[];
  noticesStatus?: number;
}

interface Mocks {
  read: string[];
  readAll: number;
}

async function signedIn(page: Page, options: Options = {}): Promise<Mocks> {
  const mocks: Mocks = { read: [], readAll: 0 };
  let notices = options.notices ?? [
    notice(3, 'POLL_CEILING_REACHED'),
    notice(2, 'BUYER_DATA_SUBMITTED'),
    notice(1, 'POLL_CEILING_REACHED', true),
  ];

  await page.addInitScript(() => localStorage.setItem('current-store', 'store-1'));
  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: null,
        is_platform_admin: false,
        can_create_stores: false,
        store_limit: 1,
      },
    }),
  );
  await page.route('**/v1/store', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 'store-1',
        name: 'Card Hub',
        whatsapp_status: 'ONLINE',
        role: options.role ?? 'OWNER',
        permissions: {},
      },
    }),
  );
  await page.route('**/v1/me/preferences', (route) =>
    route.fulfill({
      status: 200,
      json: {
        language: 'en',
        theme: 'SYSTEM',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        notifications: { in_app: true, email: true },
      },
    }),
  );
  await page.route('**/v1/notifications/unread-count', (route) =>
    route.fulfill({ status: 200, json: { count: notices.filter((item) => !item.read).length } }),
  );
  await page.route('**/v1/notifications/read-all', (route) => {
    mocks.readAll += 1;
    notices = notices.map((item) => ({ ...item, read: true }));
    return route.fulfill({ status: 204 });
  });
  await page.route('**/v1/notifications/*/read', (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    mocks.read.push(id);
    notices = notices.map((item) => (item.id === id ? { ...item, read: true } : item));
    return route.fulfill({ status: 204 });
  });
  await page.route(/\/v1\/notifications(\?.*)?$/, (route) => {
    if (options.noticesStatus) {
      return route.fulfill({
        status: options.noticesStatus,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Error', status: options.noticesStatus },
      });
    }
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    // Two pages when there are more than 2 notices: the first one has 2.
    const first = notices.slice(0, 2);
    const rest = notices.slice(2);
    return route.fulfill({
      status: 200,
      json:
        cursor === null
          ? { items: first, next_cursor: rest.length > 0 ? 'page-2' : null }
          : { items: rest, next_cursor: null },
    });
  });
  await page.route('**/v1/team*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: [
          {
            id: 'm-1',
            user_id: OWNER_ID,
            email: 'igor@example.com',
            name: null,
            role: 'OWNER',
            permissions: {},
            created_at: '2026-10-01T00:00:00Z',
          },
          {
            id: 'm-2',
            user_id: STAFF_ID,
            email: 'ana@example.com',
            name: 'Ana Souza',
            role: 'STAFF',
            permissions: {},
            created_at: '2026-10-02T00:00:00Z',
          },
        ],
        next_cursor: null,
      },
    }),
  );
  await page.route('**/v1/activity-log*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: [
          {
            id: 'a-1',
            created_at: '2026-10-18T21:50:00Z',
            actor_user_id: OWNER_ID,
            action: 'settlement.paid',
            target_type: 'settlement',
            target_id: 'aaaaaaaa-0000-4000-8000-000000000001',
            details: {},
          },
          {
            id: 'a-2',
            created_at: '2026-10-17T18:12:00Z',
            actor_user_id: STAFF_ID,
            action: 'card.deleted',
            target_type: 'card',
            target_id: 'bbbbbbbb-0000-4000-8000-000000000002',
            details: {},
          },
          {
            id: 'a-3',
            created_at: '2026-10-16T09:00:00Z',
            actor_user_id: null,
            action: 'brand.new_action',
            target_type: null,
            target_id: null,
            details: {},
          },
        ],
        next_cursor: null,
      },
    }),
  );
  return mocks;
}

test('lists the notifications and shows how many are unread on the bell', async ({ page }) => {
  await signedIn(page);
  await page.goto('/activity');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Notifications and activity' }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Notifications (2)' })).toBeVisible();
  await expect(
    page.getByText('A poll auction reached its ceiling and is waiting for validation').first(),
  ).toBeVisible();
  await expect(page.getByText('A buyer sent their data on the settlement page')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Notifications, 2 unread' })).toBeVisible();
  await expect(page.getByText('New', { exact: true })).toHaveCount(2);
});

test('marks one notification as read and updates the numbers', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/activity');

  await page.getByRole('button', { name: 'Mark as read' }).first().click();

  await expect(page.getByRole('tab', { name: 'Notifications (1)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible();
  expect(mocks.read).toEqual(['n-3']);
});

test('marks all as read', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/activity');

  await page.getByRole('button', { name: 'Mark all as read' }).click();

  await expect(page.getByText('All notifications marked as read.')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  expect(mocks.readAll).toBe(1);
});

test('shows more notifications by cursor', async ({ page }) => {
  await signedIn(page);
  await page.goto('/activity');
  await expect(page.getByRole('listitem').filter({ hasText: 'ceiling' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Show more' }).click();

  await expect(page.getByRole('listitem').filter({ hasText: 'ceiling' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
});

test('does not leave a notification blank when the kind is new to the interface', async ({
  page,
}) => {
  await signedIn(page, { notices: [notice(3, 'SOMETHING_NEW')] });
  await page.goto('/activity');

  await expect(page.getByText('New notification')).toBeVisible();
});

test('shows an error with a way to try again when the list does not load', async ({ page }) => {
  await signedIn(page, { noticesStatus: 500 });
  await page.goto('/activity');

  await expect(page.getByText('We could not load the notifications')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('shows the owner the activity log with who did what, in plain words', async ({ page }) => {
  await signedIn(page);
  await page.goto('/activity');

  await page.getByRole('tab', { name: 'Activity log' }).click();

  const table = page.getByRole('table', { name: 'Activity of the people in the store' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByText('igor@example.com')).toBeVisible();
  await expect(table.getByText('Ana Souza')).toBeVisible();
  await expect(table.getByText('Confirmed a payment')).toBeVisible();
  await expect(table.getByText('Deleted a card')).toBeVisible();
  await expect(table.getByText('Settlement #aaaaaaaa')).toBeVisible();
  await expect(table.getByText('System')).toBeVisible();
  await expect(table.getByText('Did something')).toBeVisible();
  await expect(page.getByText('The log is visible only to the owner')).toBeVisible();
});

test('does not offer the activity log to staff', async ({ page }) => {
  await signedIn(page, { role: 'STAFF' });
  await page.goto('/activity');

  await expect(page.getByRole('tab', { name: /Notifications/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Activity log' })).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/activity');
  await page.getByRole('tab', { name: 'Activity log' }).click();
  await expect(page.getByText('Confirmed a payment')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
