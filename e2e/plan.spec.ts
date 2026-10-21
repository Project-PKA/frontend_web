import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

interface Req {
  id: string;
  requested_plan: string | null;
  message: string | null;
  status: 'PENDING' | 'APPLIED' | 'REFUSED';
  decided_at: string | null;
  created_at: string;
}

const REFUSED: Req = {
  id: 'r-1',
  requested_plan: 'NETWORK',
  message: 'We opened a second store',
  status: 'REFUSED',
  decided_at: '2030-02-10T15:00:00.000Z',
  created_at: '2030-02-08T15:00:00.000Z',
};

const PENDING: Req = {
  id: 'r-2',
  requested_plan: 'STORE',
  message: 'More groups, please',
  status: 'PENDING',
  decided_at: null,
  created_at: '2030-03-01T15:00:00.000Z',
};

interface Options {
  role?: 'OWNER' | 'STAFF';
  limits?: { members: number; cards: number | null; groups: number };
  usage?: { members: number; pending_invitations: number; cards: number; groups: number };
  pending?: Req | null;
  recent?: Req[];
  postAnswer?: object;
  planStatus?: number;
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = { requests: [] as Record<string, unknown>[], reads: 0 };
  let pending = options.pending === undefined ? null : options.pending;
  let recent = options.recent ?? [];

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
  await page.route(/\/v1\/store$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 'store-1',
        name: 'Card Hub',
        whatsapp_status: 'ONLINE',
        inactivity_days_limit: null,
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
    route.fulfill({ status: 200, json: { count: 0 } }),
  );
  await page.route(/\/v1\/plan\/change-requests$/, (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.requests.push(body);
    if (options.postAnswer) {
      return route.fulfill(options.postAnswer as Parameters<typeof route.fulfill>[0]);
    }
    pending = {
      id: 'r-new',
      requested_plan: (body.requested_plan as string | undefined) ?? null,
      message: (body.message as string | undefined) ?? null,
      status: 'PENDING',
      decided_at: null,
      created_at: '2030-03-05T15:00:00.000Z',
    };
    recent = [pending, ...recent.filter((item) => item.status !== 'PENDING')];
    return route.fulfill({ status: 201, json: pending });
  });
  await page.route(/\/v1\/plan$/, (route) => {
    calls.reads += 1;
    if (options.planStatus) return route.fulfill(problem(options.planStatus, 'INTERNAL'));
    return route.fulfill({
      status: 200,
      json: {
        plan: 'STANDARD',
        limits: options.limits ?? { members: 5, cards: 500, groups: 3 },
        usage: options.usage ?? { members: 3, pending_invitations: 1, cards: 120, groups: 1 },
        pending_request: pending,
        recent_requests: recent,
      },
    });
  });
  return calls;
}

test('shows the plan and what is used of each limit', async ({ page }) => {
  await signedIn(page);
  await page.goto('/plan');

  await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible();
  const card = page.getByRole('region', { name: 'Current plan' });
  await expect(card).toContainText('Standard');
  await expect(card).toContainText('Active');
  await expect(card).toContainText('1 of 3');
  await expect(card).toContainText('3 of 5');
  await expect(card).toContainText('120 of 500');
  await expect(card.getByRole('progressbar', { name: 'Cards in stock' })).toHaveAttribute(
    'aria-valuenow',
    '120',
  );
  await expect(card).toContainText('1 invitation pending');
  await expect(page.getByText('There is no billing in this phase')).toBeVisible();
});

test('says cards without a limit are unlimited, with no bar', async ({ page }) => {
  await signedIn(page, {
    limits: { members: 5, cards: null, groups: 3 },
    usage: { members: 1, pending_invitations: 0, cards: 4000, groups: 1 },
  });
  await page.goto('/plan');

  const card = page.getByRole('region', { name: 'Current plan' });
  await expect(card).toContainText('4000, no limit');
  await expect(card.getByRole('progressbar', { name: 'Cards in stock' })).toHaveCount(0);
  await expect(card.getByRole('progressbar')).toHaveCount(2);
});

test('warns when a limit was reached', async ({ page }) => {
  await signedIn(page, {
    usage: { members: 5, pending_invitations: 0, cards: 10, groups: 1 },
  });
  await page.goto('/plan');

  await expect(
    page.getByText('The limit was reached. Ask the administration for more room.'),
  ).toHaveCount(1);
});

test('shows the request that is waiting and the ones already decided', async ({ page }) => {
  await signedIn(page, { pending: PENDING, recent: [PENDING, REFUSED] });
  await page.goto('/plan');

  const status = page.getByRole('status').filter({ hasText: 'A plan change is waiting' });
  await expect(status).toContainText('Plan asked for: STORE');
  await expect(status).toContainText('More groups, please');
  await expect(page.getByRole('button', { name: 'Update the request' })).toBeVisible();

  const table = page.getByRole('table', { name: 'Requests' });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').filter({ hasText: 'NETWORK' })).toContainText('Refused');
  await expect(table.getByRole('row').filter({ hasText: 'More groups' })).toContainText('Waiting');
});

test('asks for a plan change, fixing the code to capitals', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/plan');

  await page.getByRole('button', { name: 'Ask for a plan change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ask for a plan change' });
  await dialog.getByLabel('Plan you want').fill(' network ');
  await dialog.getByLabel('Message').fill('  A second store opened  ');
  await dialog.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByText('Request sent to the administration.')).toBeVisible();
  expect(calls.requests).toEqual([{ requested_plan: 'NETWORK', message: 'A second store opened' }]);
  await expect(
    page.getByRole('status').filter({ hasText: 'A plan change is waiting' }),
  ).toContainText('Plan asked for: NETWORK');
});

test('lets a message go alone, without a plan', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/plan');

  await page.getByRole('button', { name: 'Ask for a plan change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ask for a plan change' });
  await dialog.getByLabel('Message').fill('Need more cards');
  await dialog.getByRole('button', { name: 'Send request' }).click();

  await expect.poll(() => calls.requests.length).toBe(1);
  expect(calls.requests[0]).toEqual({ message: 'Need more cards' });
});

test('checks the request before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/plan');

  await page.getByRole('button', { name: 'Ask for a plan change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ask for a plan change' });
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText('Tell which plan you want, or write a message.')).toBeVisible();

  await dialog.getByLabel('Plan you want').fill('9 bad');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText(/capital letters, digits and _/)).toBeVisible();
  expect(calls.requests).toEqual([]);
});

test('shows the error of the request translated, never the detail', async ({ page }) => {
  await signedIn(page, { postAnswer: problem(409, 'OWNER_REQUIRED') });
  await page.goto('/plan');

  await page.getByRole('button', { name: 'Ask for a plan change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ask for a plan change' });
  await dialog.getByLabel('Message').fill('Please');
  await dialog.getByRole('button', { name: 'Send request' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Only the store owner');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('shows an error with a way to try again when the plan fails to load', async ({ page }) => {
  await signedIn(page, { planStatus: 400 });
  await page.goto('/plan');

  await expect(page.getByText('We could not load the plan')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('does not open the plan for staff', async ({ page }) => {
  const calls = await signedIn(page, { role: 'STAFF' });
  await page.goto('/plan');

  await expect(page.getByRole('region', { name: 'Current plan' })).toHaveCount(0);
  expect(calls.reads).toBe(0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page, { pending: PENDING, recent: [PENDING, REFUSED] });
  await page.goto('/plan');
  await expect(page.getByRole('region', { name: 'Current plan' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
