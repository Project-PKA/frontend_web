import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

const preferences = {
  language: 'en',
  theme: 'SYSTEM',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  notifications: { in_app: true, email: true },
};

interface Mocks {
  patches: Record<string, unknown>[];
  revoked: string[];
}

async function signedIn(page: Page, options: { patchAnswer?: object } = {}): Promise<Mocks> {
  const mocks: Mocks = { patches: [], revoked: [] };
  let current = { ...preferences };
  let sessions = [
    {
      id: 's-1',
      created_at: '2026-10-18T12:00:00Z',
      user_agent: CHROME_WINDOWS,
      ip: '203.0.113.10',
      current: true,
    },
    {
      id: 's-2',
      created_at: '2026-10-16T09:30:00Z',
      user_agent: SAFARI_IPHONE,
      ip: null,
      current: false,
    },
  ];

  await page.addInitScript(() => localStorage.setItem('current-store', 'store-1'));
  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: 'Ana Souza',
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
        role: 'OWNER',
        permissions: {},
      },
    }),
  );
  await page.route('**/v1/me/stores', (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: [
          { id: 'store-1', name: 'Card Hub', role: 'OWNER' },
          { id: 'store-2', name: 'Cards do Zé', role: 'STAFF' },
        ],
      },
    }),
  );
  await page.route('**/v1/me/preferences', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      mocks.patches.push(body);
      if (options.patchAnswer) return route.fulfill(options.patchAnswer);
      current = {
        ...current,
        ...body,
        notifications: {
          ...current.notifications,
          ...(body.notifications as Record<string, boolean> | undefined),
        },
      };
    }
    return route.fulfill({ status: 200, json: current });
  });
  await page.route('**/v1/me/sessions', (route) =>
    route.fulfill({ status: 200, json: { items: sessions } }),
  );
  await page.route('**/v1/me/sessions/*', (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    mocks.revoked.push(id);
    sessions = sessions.filter((item) => item.id !== id);
    return route.fulfill({ status: 204 });
  });
  return mocks;
}

test('shows who you are, your stores, your preferences and your devices', async ({ page }) => {
  await signedIn(page);
  await page.goto('/profile');

  await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();
  await expect(page.getByText('Ana Souza', { exact: true })).toBeVisible();
  await expect(page.getByText('Owner · Card Hub')).toBeVisible();
  await expect(page.getByText('Staff · Cards do Zé')).toBeVisible();
  await expect(page.getByLabel('Language')).toHaveValue('en');
  await expect(page.getByLabel('Time zone')).toHaveValue('America/Sao_Paulo');
  await expect(page.getByRole('switch', { name: 'Notifications by e-mail' })).toBeChecked();
  await expect(page.getByText('Chrome, Windows')).toBeVisible();
  await expect(page.getByText('Safari, iOS')).toBeVisible();
  await expect(page.getByText('Current', { exact: true })).toBeVisible();
});

test('does not offer to edit what the API cannot save yet', async ({ page }) => {
  await signedIn(page);
  await page.goto('/profile');

  await expect(page.getByLabel('Full name')).toBeDisabled();
  await expect(page.getByLabel('E-mail (login)')).toBeDisabled();
  await expect(page.getByText('Editing comes later')).toHaveCount(2);
});

test('saves only what changed and says so', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/profile');
  const save = page.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeDisabled();

  await page.getByText('Notifications by e-mail').click();
  await page.getByLabel('Time zone').selectOption('America/Manaus');
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByText('Changes saved.')).toBeVisible();
  expect(mocks.patches).toEqual([{ timezone: 'America/Manaus', notifications: { email: false } }]);
  await expect(save).toBeDisabled();
});

test('shows a translated message when saving fails, never the text from the server', async ({
  page,
}) => {
  await signedIn(page, { patchAnswer: problem(429, 'RATE_LIMITED') });
  await page.goto('/profile');

  await page.getByText('Notifications inside the app').click();
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('alert').filter({ hasText: /too many|try again/i })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});

test('changes the language at once and saves it in the profile', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/profile');

  await page.getByLabel('Language').selectOption('pt-BR');

  await expect(page.getByRole('heading', { level: 1, name: 'Meu perfil' })).toBeVisible();
  expect(mocks.patches).toEqual([{ language: 'pt-BR' }]);
});

test('ends another session and keeps the current one', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/profile');

  await expect(page.getByRole('button', { name: /End the session on Chrome/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'End the session on Safari, iOS' }).click();

  await expect(page.getByText('Session ended.')).toBeVisible();
  await expect(page.getByText('Safari, iOS')).toHaveCount(0);
  await expect(page.getByText('Chrome, Windows')).toBeVisible();
  expect(mocks.revoked).toEqual(['s-2']);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
