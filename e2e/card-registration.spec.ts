import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const CATALOG_CARD = {
  id: 'swsh4-044',
  name: 'Pikachu VMAX',
  names: {},
  number: '044/185',
  set_id: null,
  set_name: 'Vivid Voltage',
  image_url: 'https://images.example.com/swsh4-044/low.png',
  image_high_url: 'https://images.example.com/swsh4-044/high.png',
  rarity: 'Rare Ultra',
};

const CONSIGNOR = {
  id: 'u-1',
  phone: '5511988771020',
  name: 'Ana Souza',
  email: null,
  cpf_masked: '***.456.789-**',
  kind: 'CUSTOMER',
  is_blacklisted: false,
  blacklist_reason: null,
  last_interaction_at: null,
  address: null,
  created_at: '2026-10-01T12:00:00Z',
};

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

interface Options {
  createAnswer?: object;
  photoStatus?: number;
  linkAnswer?: object;
  consignor?: typeof CONSIGNOR;
}

interface Calls {
  created: Record<string, unknown>[];
  photos: { contentType: string | undefined; size: number }[];
  links: string[];
}

async function signedIn(page: Page, options: Options = {}): Promise<Calls> {
  const calls: Calls = { created: [], photos: [], links: [] };

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
        role: 'OWNER',
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
  await page.route('https://images.example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route(/\/v1\/catalog\/search/, (route) =>
    route.fulfill({ status: 200, json: { items: [CATALOG_CARD] } }),
  );
  await page.route(/\/v1\/customers(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      json: { items: [options.consignor ?? CONSIGNOR], next_cursor: null },
    }),
  );
  await page.route(/\/v1\/customers\/[^/]+\/consignor-link$/, (route) => {
    calls.links.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill(
      options.linkAnswer
        ? (options.linkAnswer as Parameters<typeof route.fulfill>[0])
        : {
            status: 201,
            json: {
              link: {
                id: 'l-1',
                kind: 'CONSIGNOR',
                settlement_id: null,
                customer_id: 'u-1',
                state: 'ACTIVE',
                expires_at: '2026-11-18T12:00:00Z',
                created_at: '2026-10-19T12:00:00Z',
              },
              token: 'tok_abc123',
            },
          },
    );
  });
  await page.route(/\/v1\/cards\/[^/]+\/photos$/, (route) => {
    if (options.photoStatus) return route.fulfill(problem(options.photoStatus, 'INVALID_IMAGE'));
    calls.photos.push({
      contentType: route.request().headers()['content-type'],
      size: route.request().postDataBuffer()?.length ?? 0,
    });
    return route.fulfill({ status: 201, json: { photo: 'p1.png', photos: ['p1.png'] } });
  });
  await page.route(/\/v1\/cards(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      calls.created.push(route.request().postDataJSON() as Record<string, unknown>);
      if (options.createAnswer) {
        return route.fulfill(options.createAnswer as Parameters<typeof route.fulfill>[0]);
      }
      return route.fulfill({
        status: 201,
        json: {
          id: 'c-new',
          short_code: 'A7',
          catalog: CATALOG_CARD,
          language: 'PT',
          condition: 'NM',
          is_foil: false,
          photos: [],
          notes: null,
          origin: 'OWN',
          consignor: null,
          commission_pct: null,
          status: 'AVAILABLE',
          created_at: '2026-10-19T12:00:00Z',
          updated_at: '2026-10-19T12:00:00Z',
        },
      });
    }
    return route.fulfill({ status: 200, json: { items: [], next_cursor: null } });
  });
  await page.route(/\/v1\/cards\/c-new$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        card: {
          id: 'c-new',
          short_code: 'A7',
          catalog: CATALOG_CARD,
          language: 'PT',
          condition: 'NM',
          is_foil: false,
          photos: [],
          notes: null,
          origin: 'OWN',
          consignor: null,
          commission_pct: null,
          status: 'AVAILABLE',
          created_at: '2026-10-19T12:00:00Z',
          updated_at: '2026-10-19T12:00:00Z',
        },
        auctions: [],
      },
    }),
  );
  return calls;
}

const search = (page: Page) => page.getByRole('combobox', { name: 'Quick search: name or number' });

async function pickCard(page: Page) {
  await page.goto('/inventory/new');
  await search(page).fill('pika');
  await page.getByRole('option', { name: /Pikachu VMAX/ }).click();
  await expect(page.getByRole('heading', { name: 'Card data and condition' })).toBeVisible();
}

test('shows the form only after a card is picked, and keeps Save off until the origin is chosen', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/inventory/new');
  await expect(page.getByRole('heading', { name: 'Card data and condition' })).toHaveCount(0);

  await pickCard(page);

  await expect(page.getByRole('button', { name: 'Save card' })).toBeDisabled();
  await expect(page.getByText('Choose the origin of the card to continue.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Own stock' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Consigned' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Own stock' }).click();
  await expect(page.getByRole('button', { name: 'Save card' })).toBeEnabled();
});

test('asks for the condition and does not guess it', async ({ page }) => {
  const calls = await signedIn(page);
  await pickCard(page);
  await page.getByRole('button', { name: 'Own stock' }).click();

  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page.getByText('This field is required.')).toBeVisible();
  expect(calls.created).toEqual([]);
});

test('registers an own card and opens it', async ({ page }) => {
  const calls = await signedIn(page);
  await pickCard(page);

  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByLabel(/^Notes/).fill('Light mark on the lower edge.');
  await page.getByRole('button', { name: 'Own stock' }).click();
  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page).toHaveURL(/\/inventory\/c-new$/);
  await expect(page.getByText('Pikachu VMAX 044/185 saved.')).toBeVisible();
  expect(calls.created).toEqual([
    {
      tcgdex_id: 'swsh4-044',
      language: 'PT',
      condition: 'NM',
      is_foil: false,
      origin: 'OWN',
      notes: 'Light mark on the lower edge.',
    },
  ]);
});

test('sends the photos after the card is saved, each as the image itself', async ({ page }) => {
  const calls = await signedIn(page);
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('SP');
  await page.getByRole('button', { name: 'Own stock' }).click();

  await page.getByLabel('Add photos', { exact: true }).setInputFiles([
    { name: 'front.png', mimeType: 'image/png', buffer: PNG },
    { name: 'back.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await expect(page.getByRole('img', { name: 'Photo 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo 1' }).click();
  await expect(page.getByRole('img', { name: 'Photo 2' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page).toHaveURL(/\/inventory\/c-new$/);
  expect(calls.photos).toEqual([{ contentType: 'image/png', size: PNG.length }]);
});

test('says which files it left out and why', async ({ page }) => {
  await signedIn(page);
  await pickCard(page);

  await page.getByLabel('Add photos', { exact: true }).setInputFiles([
    { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') },
    { name: 'ok.png', mimeType: 'image/png', buffer: PNG },
  ]);

  await expect(
    page.getByText('"doc.pdf" was left out: it is not a JPEG, PNG or WebP image.'),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
});

test('saves the card and tells which photo did not go', async ({ page }) => {
  await signedIn(page, { photoStatus: 400 });
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByRole('button', { name: 'Own stock' }).click();
  await page
    .getByLabel('Add photos', { exact: true })
    .setInputFiles([{ name: 'front.png', mimeType: 'image/png', buffer: PNG }]);

  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page.getByRole('heading', { name: 'Card saved' })).toBeFocused();
  await expect(page.getByText('#A7 Pikachu VMAX 044/185 is in your stock.')).toBeVisible();
  await expect(page.getByText('Some photos were not sent.')).toBeVisible();
  await expect(page.getByText('front.png')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the card' })).toHaveAttribute(
    'href',
    '/inventory/c-new',
  );
});

test('registers a consigned card and gives the tracking link to copy and to send', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const calls = await signedIn(page);
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByRole('button', { name: 'Consigned' }).click();
  await expect(page.getByLabel('Store commission (%)')).toHaveValue('15');

  await page.getByRole('combobox', { name: 'Consignor customer' }).fill('ana');
  await page.getByRole('option', { name: /Ana Souza/ }).click();
  await expect(page.getByText('***.456.789-**')).toBeVisible();
  await page.getByLabel('Store commission (%)').fill('12,5');
  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page.getByRole('heading', { name: 'Card saved' })).toBeVisible();
  expect(calls.created[0]).toMatchObject({
    origin: 'CONSIGNED',
    consignor_id: 'u-1',
    commission_pct: 12.5,
  });
  expect(calls.links).toEqual(['u-1']);
  const link = page.locator('.consignor-link__url');
  await expect(link).toContainText('/consignor#token=tok_abc123');
  expect(await link.textContent()).not.toContain('?');

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '/consignor#token=tok_abc123',
  );
  const whatsapp = page.getByRole('link', { name: 'Send on WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/5511988771020\?text=/);
  await expect(whatsapp).toHaveAttribute('target', '_blank');
  await expect(whatsapp).toHaveAttribute('rel', /noopener/);
});

test('wants the consignor and a valid commission for a consigned card', async ({ page }) => {
  const calls = await signedIn(page);
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByRole('button', { name: 'Consigned' }).click();
  await page.getByLabel('Store commission (%)').fill('150');

  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page.getByText('Enter a commission from 0 to 100.')).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'This field is required.' }),
  ).toBeVisible();
  expect(calls.created).toEqual([]);
});

test('warns when the consignor has no CPF, but still lets the card be saved', async ({ page }) => {
  await signedIn(page, { consignor: { ...CONSIGNOR, cpf_masked: null } });
  await pickCard(page);
  await page.getByRole('button', { name: 'Consigned' }).click();

  await page.getByRole('combobox', { name: 'Consignor customer' }).fill('ana');
  await page.getByRole('option', { name: /Ana Souza/ }).click();

  await expect(page.getByText(/has no CPF registered/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save card' })).toBeEnabled();
});

test('saves the card even when the tracking link cannot be created', async ({ page }) => {
  await signedIn(page, { linkAnswer: problem(404, 'CONSIGNOR_NOT_FOUND') });
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByRole('button', { name: 'Consigned' }).click();
  await page.getByRole('combobox', { name: 'Consignor customer' }).fill('ana');
  await page.getByRole('option', { name: /Ana Souza/ }).click();

  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(
    page.getByText('The card was saved, but the tracking link was not created.'),
  ).toBeVisible();
  await expect(page.getByText('We could not find this consignor.')).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('shows the error of the API translated and keeps the form', async ({ page }) => {
  await signedIn(page, { createAnswer: problem(409, 'CARD_LIMIT_REACHED') });
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByRole('button', { name: 'Own stock' }).click();

  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page.getByText('The card limit of the plan was reached.')).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save card' })).toBeEnabled();
  await expect(page.getByLabel(/^Condition/)).toHaveValue('NM');
});

test('starts again after a consigned card was saved', async ({ page }) => {
  await signedIn(page);
  await pickCard(page);
  await page.getByLabel(/^Condition/).selectOption('NM');
  await page.getByRole('button', { name: 'Consigned' }).click();
  await page.getByRole('combobox', { name: 'Consignor customer' }).fill('ana');
  await page.getByRole('option', { name: /Ana Souza/ }).click();
  await page.getByRole('button', { name: 'Save card' }).click();

  await page.getByRole('button', { name: 'Register another' }).click();

  await expect(search(page)).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Card data and condition' })).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways, with the whole form open', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await pickCard(page);
  await page.getByRole('button', { name: 'Consigned' }).click();
  await page
    .getByLabel('Add photos', { exact: true })
    .setInputFiles([{ name: 'front.png', mimeType: 'image/png', buffer: PNG }]);
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
