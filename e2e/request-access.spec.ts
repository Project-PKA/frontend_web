import { expect, test, type Page } from '@playwright/test';

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

type Captured = { body: Record<string, unknown> | null; count: number };

async function mockApi(page: Page, answer?: Parameters<Page['route']>[1]): Promise<Captured> {
  const captured: Captured = { body: null, count: 0 };
  await page.route('**/v1/auth/refresh', (route) => route.fulfill(problem(401, 'INVALID_REFRESH')));
  await page.route('**/v1/public/access-requests', (route) => {
    captured.count += 1;
    captured.body = route.request().postDataJSON() as Record<string, unknown>;
    return answer
      ? answer(route, route.request())
      : route.fulfill({ status: 202, json: { status: 'RECEIVED' } });
  });
  return captured;
}

async function fill(page: Page, overrides: Partial<Record<string, string>> = {}) {
  const values = {
    'Your name': 'Ana Souza',
    'E-mail': 'ana@example.com',
    'Store name': 'Poké Card Hub',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label).fill(value);
}

test('sends the request and confirms it, moving the focus to the confirmation', async ({
  page,
}) => {
  const captured = await mockApi(page);
  await page.goto('/request-access');
  await fill(page);

  await page.getByRole('button', { name: 'Send request' }).click();

  const heading = page.getByRole('heading', { level: 1, name: 'Request received' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(
    page.getByText('Our team will review it and reply to ana@example.com.'),
  ).toBeVisible();
  expect(captured.body).toEqual({
    name: 'Ana Souza',
    email: 'ana@example.com',
    store_name: 'Poké Card Hub',
    website: '',
  });
});

test('sends the optional fields when they are filled in', async ({ page }) => {
  const captured = await mockApi(page);
  await page.goto('/request-access');
  await fill(page, {
    'WhatsApp (optional)': '11912345678',
    'Message (optional)': 'We run auctions weekly.',
  });

  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  expect(captured.body).toMatchObject({
    whatsapp: '(11) 91234-5678',
    message: 'We run auctions weekly.',
    website: '',
  });
});

test('formats the WhatsApp number as it is typed', async ({ page }) => {
  await mockApi(page);
  await page.goto('/request-access');

  const field = page.getByLabel('WhatsApp (optional)');
  await field.pressSequentially('11912345678');

  await expect(field).toHaveValue('(11) 91234-5678');
});

test('asks for what is missing without calling the API', async ({ page }) => {
  const captured = await mockApi(page);
  await page.goto('/request-access');

  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByText('This field is required.')).toHaveCount(3);
  expect(captured.count).toBe(0);
});

test('refuses an e-mail that is not one and a number without the area code', async ({ page }) => {
  const captured = await mockApi(page);
  await page.goto('/request-access');
  await fill(page, { 'E-mail': 'ana@', 'WhatsApp (optional)': '91234' });

  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByText('Enter a valid e-mail address.')).toBeVisible();
  await expect(page.getByText('Enter the number with the area code.')).toBeVisible();
  expect(captured.count).toBe(0);
});

test('keeps the decoy out of sight, out of the keyboard and out of the screen reader', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/request-access');

  const decoy = page.locator('input[name="website"]');
  await expect(decoy).toHaveCount(1);
  await expect(decoy).toHaveValue('');
  expect(await decoy.evaluate((element) => element.closest('[inert]') !== null)).toBe(true);
  expect(await decoy.evaluate((element) => element.closest('[aria-hidden="true"]') !== null)).toBe(
    true,
  );
  await expect(page.getByRole('textbox', { name: 'Website' })).toHaveCount(0);
});

test('drops a request whose decoy was filled in, and looks as if it worked', async ({ page }) => {
  const captured = await mockApi(page);
  await page.goto('/request-access');
  await fill(page);
  await page.locator('input[name="website"]').evaluate((element: HTMLInputElement) => {
    element.value = 'https://spam.example.com';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  expect(captured.count).toBe(0);
});

test('shows the reason in the right language when the API refuses', async ({ page }) => {
  await mockApi(page, (route) => route.fulfill(problem(429, 'RATE_LIMITED')));
  await page.goto('/request-access');
  await fill(page);

  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Too many attempts. Wait a moment and try again.' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Request access' })).toBeVisible();
});

test('links to the login for someone who already has an invitation', async ({ page }) => {
  await mockApi(page);
  await page.goto('/request-access');

  await page.getByRole('link', { name: 'I already have an invitation' }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test('is in Portuguese for a browser in Portuguese', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'pt-BR' });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto('/request-access');

  await expect(page.getByRole('heading', { level: 1, name: 'Solicitar acesso' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar solicitação' })).toBeVisible();
  await context.close();
});
