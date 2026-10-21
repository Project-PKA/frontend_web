import { expect, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'STAFF';
  permissions: Record<string, boolean>;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: 'STAFF';
  permissions: Record<string, boolean>;
  state: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
}

const ALL = {
  can_manage_inventory: true,
  can_manage_auctions: true,
  can_manage_customers: true,
  can_view_finance: true,
  can_delete: true,
};

const MEMBERS = (): Member[] => [
  {
    id: 'm-2',
    user_id: 'u-2',
    email: 'ana@example.com',
    name: 'Ana',
    role: 'STAFF',
    permissions: {
      can_manage_inventory: true,
      can_manage_auctions: true,
      can_manage_customers: true,
      can_view_finance: false,
      can_delete: false,
    },
    created_at: '2030-03-02T12:00:00.000Z',
  },
  {
    id: 'm-1',
    user_id: 'u-1',
    email: 'igor@example.com',
    name: null,
    role: 'OWNER',
    permissions: ALL,
    created_at: '2030-03-01T12:00:00.000Z',
  },
];

const INVITATIONS = (): Invitation[] => [
  {
    id: 'i-1',
    email: 'leo@example.com',
    role: 'STAFF',
    permissions: { can_manage_inventory: true },
    state: 'PENDING',
    expires_at: '2030-03-09T12:00:00.000Z',
    created_at: '2030-03-02T12:00:00.000Z',
  },
  {
    id: 'i-2',
    email: 'bia@example.com',
    role: 'STAFF',
    permissions: {},
    state: 'EXPIRED',
    expires_at: '2030-02-20T12:00:00.000Z',
    created_at: '2030-02-13T12:00:00.000Z',
  },
  {
    id: 'i-3',
    email: 'old@example.com',
    role: 'STAFF',
    permissions: {},
    state: 'ACCEPTED',
    expires_at: '2030-02-20T12:00:00.000Z',
    created_at: '2030-02-13T12:00:00.000Z',
  },
];

interface Options {
  role?: 'OWNER' | 'STAFF';
  inviteAnswer?: object;
  patchAnswer?: object;
  removeAnswer?: object;
}

/** The switch is drawn by its label: a click on the row is what a person does. */
async function toggle(dialog: Locator, name: string) {
  await dialog.locator('.perm').filter({ hasText: name }).locator('label.switch').click();
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = {
    invited: [] as Record<string, unknown>[],
    patched: [] as { id: string; body: Record<string, unknown> }[],
    resent: [] as string[],
    revoked: [] as string[],
    removed: [] as string[],
  };
  const members = MEMBERS();
  const invitations = INVITATIONS();

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

  await page.route(/\/v1\/team\/invitations\/[^/]+\/resend$/, (route) => {
    calls.resent.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill({ status: 200, json: { id: 'i-1', expires_at: '2030-03-16T12:00:00Z' } });
  });
  await page.route(/\/v1\/team\/invitations\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    calls.revoked.push(id);
    const found = invitations.find((item) => item.id === id);
    if (found) found.state = 'REVOKED';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route(/\/v1\/team\/invitations(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.invited.push(body);
      if (options.inviteAnswer) {
        return route.fulfill(options.inviteAnswer as Parameters<typeof route.fulfill>[0]);
      }
      invitations.push({
        id: 'i-new',
        email: String(body.email),
        role: 'STAFF',
        permissions: body.permissions as Record<string, boolean>,
        state: 'PENDING',
        expires_at: '2030-03-16T12:00:00.000Z',
        created_at: '2030-03-09T12:00:00.000Z',
      });
      return route.fulfill({
        status: 201,
        json: { id: 'i-new', expires_at: '2030-03-16T12:00:00Z' },
      });
    }
    return route.fulfill({ status: 200, json: { items: invitations, next_cursor: null } });
  });
  await page.route(/\/v1\/team\/(?!invitations)[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { permissions: Record<string, boolean> };
      calls.patched.push({ id, body });
      if (options.patchAnswer) {
        return route.fulfill(options.patchAnswer as Parameters<typeof route.fulfill>[0]);
      }
      const found = members.find((item) => item.id === id)!;
      found.permissions = body.permissions;
      return route.fulfill({ status: 200, json: found });
    }
    calls.removed.push(id);
    if (options.removeAnswer) {
      return route.fulfill(options.removeAnswer as Parameters<typeof route.fulfill>[0]);
    }
    members.splice(
      members.findIndex((item) => item.id === id),
      1,
    );
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route(/\/v1\/team(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, json: { items: members, next_cursor: null } }),
  );
  return calls;
}

test('lists the owner first, then the employee, then the open invitations', async ({ page }) => {
  await signedIn(page);
  await page.goto('/team');

  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Team' });
  // Header, owner, employee and two open invitations (the accepted one is already a member).
  await expect(table.getByRole('row')).toHaveCount(5);
  const rows = table.getByRole('row');
  await expect(rows.nth(1)).toContainText('igor@example.com');
  await expect(rows.nth(1)).toContainText('Owner');
  await expect(rows.nth(1)).toContainText('All');
  await expect(rows.nth(2)).toContainText('ana@example.com');
  await expect(rows.nth(2)).toContainText('Manage inventory, Manage auctions, Manage customers');
  await expect(rows.nth(3)).toContainText('Pending invitation');
  await expect(rows.nth(4)).toContainText('Invitation expired');
});

test('gives the owner no buttons: the permissions of the owner are fixed', async ({ page }) => {
  await signedIn(page);
  await page.goto('/team');

  const owner = page.getByRole('row').filter({ hasText: 'igor@example.com' });
  await expect(owner.getByRole('button')).toHaveCount(0);
});

test('invites by e-mail with the permissions of the design, deleting off', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/team');

  await page.getByRole('button', { name: 'Invite employee' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite employee' });
  await expect(dialog.getByRole('switch', { name: 'Manage inventory' })).toBeChecked();
  await expect(
    dialog.getByRole('switch', { name: 'View the finance dashboard' }),
  ).not.toBeChecked();
  await expect(dialog.getByRole('switch', { name: 'Delete records' })).not.toBeChecked();
  await expect(dialog.getByText('Blocked by default')).toBeVisible();

  await dialog.getByLabel('E-mail').fill('  carla@example.com ');
  await toggle(dialog, 'View the finance dashboard');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();

  await expect(page.getByText('Invitation sent to carla@example.com.')).toBeVisible();
  expect(calls.invited).toEqual([
    {
      email: 'carla@example.com',
      permissions: {
        can_manage_inventory: true,
        can_manage_auctions: true,
        can_manage_customers: true,
        can_view_finance: true,
        can_delete: false,
      },
    },
  ]);
  await expect(page.getByRole('row').filter({ hasText: 'carla@example.com' })).toContainText(
    'Pending invitation',
  );
});

test('checks the e-mail before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/team');

  await page.getByRole('button', { name: 'Invite employee' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite employee' });
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(dialog.getByText('Enter the e-mail.')).toBeVisible();

  await dialog.getByLabel('E-mail').fill('not-an-email');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(dialog.getByText('Enter a valid e-mail.')).toBeVisible();
  expect(calls.invited).toEqual([]);
});

test('shows the error of the invitation translated, inside the dialog', async ({ page }) => {
  await signedIn(page, { inviteAnswer: problem(409, 'INVITATION_NOT_ALLOWED') });
  await page.goto('/team');

  await page.getByRole('button', { name: 'Invite employee' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite employee' });
  await dialog.getByLabel('E-mail').fill('carla@example.com');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();

  await expect(dialog.getByRole('alert')).toContainText('cannot be accepted');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('edits the permissions of an employee and sends all five', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/team');

  await page.getByRole('button', { name: 'Edit permissions of ana@example.com' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit permissions' });
  await expect(dialog.getByRole('switch', { name: 'Manage auctions' })).toBeChecked();
  await toggle(dialog, 'Manage auctions');
  await toggle(dialog, 'Delete records');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Permissions saved.')).toBeVisible();
  expect(calls.patched).toEqual([
    {
      id: 'm-2',
      body: {
        permissions: {
          can_manage_inventory: true,
          can_manage_auctions: false,
          can_manage_customers: true,
          can_view_finance: false,
          can_delete: true,
        },
      },
    },
  ]);
  await expect(page.getByRole('row').filter({ hasText: 'ana@example.com' })).toContainText(
    'Manage inventory, Manage customers, Delete records',
  );
});

test('sends an invitation again', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/team');

  await page.getByRole('button', { name: 'Resend the invitation to leo@example.com' }).click();
  await expect(page.getByText('Invitation sent again to leo@example.com.')).toBeVisible();
  expect(calls.resent).toEqual(['i-1']);
});

test('revokes an invitation only after asking', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/team');

  await page.getByRole('button', { name: 'Revoke the invitation of leo@example.com' }).click();
  const dialog = page.getByRole('dialog', { name: 'Revoke the invitation' });
  await expect(dialog).toContainText('stops working right away');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(calls.revoked).toEqual([]);

  await page.getByRole('button', { name: 'Revoke the invitation of leo@example.com' }).click();
  await dialog.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('Invitation revoked.')).toBeVisible();
  expect(calls.revoked).toEqual(['i-1']);
  await expect(page.getByRole('row').filter({ hasText: 'leo@example.com' })).toHaveCount(0);
});

test('removes an employee only after asking', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/team');

  await page.getByRole('button', { name: 'Remove ana@example.com from the team' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove from the team' });
  await expect(dialog).toContainText('loses access to the store right away');
  await dialog.getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('Removed from the team.')).toBeVisible();
  expect(calls.removed).toEqual(['m-2']);
  await expect(page.getByRole('row').filter({ hasText: 'ana@example.com' })).toHaveCount(0);
});

test('shows the error of the removal translated, and keeps the person', async ({ page }) => {
  await signedIn(page, { removeAnswer: problem(409, 'LAST_OWNER') });
  await page.goto('/team');

  await page.getByRole('button', { name: 'Remove ana@example.com from the team' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove from the team' });
  await dialog.getByRole('button', { name: 'Remove' }).click();

  await expect(dialog.getByRole('alert')).toContainText('at least one owner');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('does not open the team for staff', async ({ page }) => {
  await signedIn(page, { role: 'STAFF' });
  await page.goto('/team');

  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Invite employee' })).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);
  await page.goto('/team');
  await expect(page.getByRole('button', { name: 'Invite employee' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
