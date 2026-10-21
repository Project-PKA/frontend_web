import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const TOKEN = 'tok_0123456789abcdefghij';

const SETTLEMENT = {
  store_name: 'Card Hub',
  pix_key: 'loja-pix-key',
  status: 'PENDING',
  payment_claimed_at: null,
  receipt_sent: false,
  total_amount: '115.00',
  expires_at: '2030-03-10T12:00:00Z',
  items: [
    { short_code: '0366', name: 'Gardevoir ex', condition: 'NM', language: 'PT', amount: '95.00' },
    { short_code: '0359', name: 'Ralts Promo', condition: 'SP', language: 'EN', amount: '20.00' },
  ],
  buyer: { first_name: 'Bruno', cpf_masked: null, city: null, state: null, has_address: false },
};

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

interface SettlementOptions {
  page?: object;
  viewAnswer?: object;
  dataAnswer?: object;
  paidAnswer?: object;
  receiptAnswer?: object;
}

async function settlementApi(page: Page, options: SettlementOptions = {}) {
  const calls = {
    views: [] as Record<string, unknown>[],
    data: [] as Record<string, unknown>[],
    paid: [] as Record<string, unknown>[],
    headers: [] as Record<string, string>[],
    receipts: [] as { token: string | undefined; type: string | undefined; size: number }[],
  };
  let current: object = options.page ?? SETTLEMENT;

  await page.route(/\/v1\/public\/settlement\/receipt$/, (route) => {
    const request = route.request();
    calls.receipts.push({
      token: request.headers()['x-public-token'],
      type: request.headers()['content-type'],
      size: request.postDataBuffer()?.length ?? 0,
    });
    if (options.receiptAnswer) {
      return route.fulfill(options.receiptAnswer as Parameters<typeof route.fulfill>[0]);
    }
    current = { ...current, receipt_sent: true };
    return route.fulfill({ status: 200, json: { result: 'OK' } });
  });
  await page.route(/\/v1\/public\/settlement\/paid$/, (route) => {
    calls.paid.push(route.request().postDataJSON() as Record<string, unknown>);
    if (options.paidAnswer)
      return route.fulfill(options.paidAnswer as Parameters<typeof route.fulfill>[0]);
    current = { ...current, payment_claimed_at: '2030-03-05T15:00:00Z' };
    return route.fulfill({ status: 200, json: { result: 'OK' } });
  });
  await page.route(/\/v1\/public\/settlement\/data$/, (route) => {
    calls.data.push(route.request().postDataJSON() as Record<string, unknown>);
    if (options.dataAnswer)
      return route.fulfill(options.dataAnswer as Parameters<typeof route.fulfill>[0]);
    current = {
      ...current,
      buyer: {
        first_name: 'Bruno',
        cpf_masked: '***.***.***-25',
        city: 'São Paulo',
        state: 'SP',
        has_address: true,
      },
    };
    return route.fulfill({ status: 200, json: { result: 'OK' } });
  });
  await page.route(/\/v1\/public\/settlement$/, (route) => {
    calls.views.push(route.request().postDataJSON() as Record<string, unknown>);
    calls.headers.push(route.request().headers());
    if (options.viewAnswer)
      return route.fulfill(options.viewAnswer as Parameters<typeof route.fulfill>[0]);
    return route.fulfill({ status: 200, json: current });
  });
  return calls;
}

// ----------------------------------------------------- settlement of a buyer

test('shows the summary of the settlement, with the token only in the fragment', async ({
  page,
}) => {
  const calls = await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Your settlement, Bruno' }),
  ).toBeVisible();
  await expect(page.getByText('Waiting for payment')).toBeVisible();
  await expect(page.getByText('You won 2 cards at the auctions of Card Hub.')).toBeVisible();
  const table = page.getByRole('table', { name: 'Cards you won' });
  await expect(table.getByRole('row').filter({ hasText: 'Gardevoir ex' })).toContainText(
    /R\$\s?95\.00/,
  );
  await expect(table.getByRole('row').filter({ hasText: 'Total' })).toContainText(/R\$\s?115\.00/);

  expect(calls.views).toEqual([{ token: TOKEN }]);
  // No session is sent, and the token never goes in the address except the fragment.
  expect(calls.headers[0]?.authorization).toBeUndefined();
  expect(page.url()).toContain(`#token=${TOKEN}`);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
});

test('says the same thing for a missing, invalid, expired or blocked link', async ({ page }) => {
  await settlementApi(page, { viewAnswer: problem(404, 'PUBLIC_LINK_NOT_FOUND') });

  await page.goto(`/settlement#token=${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
  await expect(page.getByText('The link is invalid or has expired.')).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);

  await page.goto('/settlement');
  await expect(page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
  await page.goto('/settlement#token=short');
  await expect(page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
});

test('shows a way to try again when the page fails for another reason', async ({ page }) => {
  await settlementApi(page, { viewAnswer: problem(400, 'VALIDATION_ERROR') });
  await page.goto(`/settlement#token=${TOKEN}`);

  await expect(page.getByText('We could not open your settlement')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('copies the PIX key and the id of a card', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await expect(page.getByText('PIX key: loja-pix-key')).toBeVisible();
  await page.getByRole('button', { name: 'Copy key' }).click();
  await expect(page.getByText('PIX key copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('loja-pix-key');

  await page.getByRole('button', { name: 'Copy #0366' }).click();
  await expect(page.getByText('#0366 copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#0366');
});

test('says the store has not shared a PIX key yet', async ({ page }) => {
  await settlementApi(page, { page: { ...SETTLEMENT, pix_key: null } });
  await page.goto(`/settlement#token=${TOKEN}`);

  await expect(page.getByText('The store has not shared a PIX key yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy key' })).toHaveCount(0);
});

test('saves the CPF and the address, typed with their masks and with the consent', async ({
  page,
}) => {
  const calls = await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await page.getByLabel('CPF', { exact: true }).fill('52998224725');
  await expect(page.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25');
  await page.getByLabel('Postal code (CEP)').fill('01310100');
  await expect(page.getByLabel('Postal code (CEP)')).toHaveValue('01310-100');
  await page.getByLabel('Street').fill('Rua A');
  await page.getByLabel('Number').fill('10');
  await page.getByLabel('City').fill('São Paulo');
  await page.getByLabel('State (UF)').fill('sp');
  await page.locator('label.switch').filter({ hasText: 'I agree that the store keeps' }).click();
  await page.getByRole('button', { name: 'Save my data' }).click();

  await expect(page.getByText('Data saved.')).toBeVisible();
  expect(calls.data).toEqual([
    {
      token: TOKEN,
      cpf: '52998224725',
      address: {
        zip: '01310100',
        street: 'Rua A',
        number: '10',
        comp: null,
        city: 'São Paulo',
        state: 'SP',
      },
      consent: { accepted: true, version: expect.any(String) },
    },
  ]);
  await expect(page.getByText('Saved: CPF ***.***.***-25 · São Paulo / SP')).toBeVisible();
});

test('checks the data and the consent before calling the API', async ({ page }) => {
  const calls = await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await page.getByRole('button', { name: 'Save my data' }).click();
  await expect(page.getByText('Enter a valid CPF.')).toBeVisible();
  await expect(page.getByText('Enter a valid postal code (CEP).')).toBeVisible();
  await expect(page.getByText('Enter the two letters of the state.')).toBeVisible();
  await expect(page.getByText('You need to agree to continue.')).toBeVisible();
  expect(calls.data).toEqual([]);
});

test('shows the error of the data translated, keeping what was typed', async ({ page }) => {
  await settlementApi(page, { dataAnswer: problem(422, 'PUBLIC_CPF_INVALID') });
  await page.goto(`/settlement#token=${TOKEN}`);

  await page.getByLabel('CPF', { exact: true }).fill('11111111111');
  await page.getByLabel('Postal code (CEP)').fill('01310100');
  await page.getByLabel('Street').fill('Rua A');
  await page.getByLabel('Number').fill('10');
  await page.getByLabel('City').fill('São Paulo');
  await page.getByLabel('State (UF)').fill('SP');
  await page.locator('label.switch').filter({ hasText: 'I agree that the store keeps' }).click();
  await page.getByRole('button', { name: 'Save my data' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid CPF.' })).toBeVisible();
  await expect(page.getByLabel('Street')).toHaveValue('Rua A');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('warns the store that the buyer paid, and never calls it paid', async ({ page }) => {
  const calls = await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await page.getByRole('button', { name: 'I already paid, notify the store' }).click();
  await expect(page.getByText('We warned the store.')).toBeVisible();
  expect(calls.paid).toEqual([{ token: TOKEN }]);
  await expect(page.getByText(/You told the store you paid on/)).toBeVisible();
  // The store is the one that confirms: the page still waits for it.
  await expect(page.getByText('Waiting for payment')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notify the store again' })).toBeVisible();
  await expect(page.getByText('it is the store that confirms the payment')).toBeVisible();
});

test('says so when the settlement is already paid, and offers no notice', async ({ page }) => {
  await settlementApi(page, { page: { ...SETTLEMENT, status: 'PAID' } });
  await page.goto(`/settlement#token=${TOKEN}`);

  await expect(page.getByText('Paid', { exact: true })).toBeVisible();
  await expect(page.getByText('The store confirmed your payment.')).toBeVisible();
  await expect(page.getByRole('button', { name: /notify the store/i })).toHaveCount(0);
});

test('translates the error of the notice, never the detail', async ({ page }) => {
  await settlementApi(page, { paidAnswer: problem(429, 'RATE_LIMITED') });
  await page.goto(`/settlement#token=${TOKEN}`);

  await page.getByRole('button', { name: 'I already paid, notify the store' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Too many attempts' })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('sends the receipt as an image, with the token in the header', async ({ page }) => {
  const calls = await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await page
    .getByLabel('Receipt (optional)')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Send receipt' }).click();

  await expect(page.getByText('Receipt sent to the store.')).toBeVisible();
  expect(calls.receipts).toEqual([{ token: TOKEN, type: 'image/png', size: PNG.length }]);
  await expect(page.getByText('You already sent the receipt to the store.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send receipt' })).toHaveCount(0);
});

test('checks the receipt before sending it', async ({ page }) => {
  const calls = await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);

  await page.getByRole('button', { name: 'Send receipt' }).click();
  await expect(page.getByText('Choose the image of the receipt.')).toBeVisible();

  await page
    .getByLabel('Receipt (optional)')
    .setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await page.getByRole('button', { name: 'Send receipt' }).click();
  await expect(page.getByText('The file is not an image.')).toBeVisible();

  await page.getByLabel('Receipt (optional)').setInputFiles({
    name: 'big.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await page.getByRole('button', { name: 'Send receipt' }).click();
  await expect(page.getByText('The image is too big. The limit is 5 MB.')).toBeVisible();
  expect(calls.receipts).toEqual([]);
});

test('says a receipt was already sent, and translates the error of the file', async ({ page }) => {
  await settlementApi(page, { receiptAnswer: { status: 200, json: { result: 'RECEIPT_EXISTS' } } });
  await page.goto(`/settlement#token=${TOKEN}`);

  await page
    .getByLabel('Receipt (optional)')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Send receipt' }).click();
  await expect(page.getByText('A receipt was already sent for this settlement.')).toBeVisible();
});

test('shows the error of the receipt translated, never the detail', async ({ page }) => {
  await settlementApi(page, { receiptAnswer: problem(422, 'RECEIPT_INVALID') });
  await page.goto(`/settlement#token=${TOKEN}`);

  await page
    .getByLabel('Receipt (optional)')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Send receipt' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The file is not an image' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('does not ask for a receipt when the settlement is already paid', async ({ page }) => {
  await settlementApi(page, { page: { ...SETTLEMENT, status: 'PAID' } });
  await page.goto(`/settlement#token=${TOKEN}`);

  await expect(page.getByLabel('Receipt (optional)')).toHaveCount(0);
});

test('the settlement fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await settlementApi(page);
  await page.goto(`/settlement#token=${TOKEN}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// --------------------------------------------------- follow-up of a consignor

const CONSIGNOR = () => ({
  store_name: 'Card Hub',
  first_name: 'Rafael',
  expires_at: '2030-03-10T12:00:00Z',
  estimate_is_final: false,
  cards: [
    {
      short_code: '0431',
      name: 'Pikachu VMAX',
      number: '044/185',
      condition: 'NM',
      language: 'PT',
      card_status: 'SCHEDULED',
      commission_pct: '15.00',
      auction: {
        status: 'ACTIVE',
        ends_at: new Date(Date.now() + 41 * 60_000).toISOString(),
        current_bid: '465.00',
        bid_count: 41,
        estimated_payout: '395.25',
        bids: [
          { amount: '465.00', at: '2030-03-05T21:42:10Z', phone: '(11) 9••••-1020' },
          { amount: '450.00', at: '2030-03-05T21:41:55Z', phone: '(21) 9••••-4455' },
        ],
      },
    },
    {
      short_code: '0301',
      name: 'Mew ex',
      number: '151',
      condition: 'SP',
      language: 'EN',
      card_status: 'SOLD',
      commission_pct: '15.00',
      auction: null,
    },
  ],
});

interface ConsignorOptions {
  answer?: object;
  page?: object;
}

async function consignorApi(page: Page, options: ConsignorOptions = {}) {
  const calls = { opened: [] as Record<string, unknown>[] };
  await page.route(/\/v1\/public\/consignor$/, (route) => {
    calls.opened.push(route.request().postDataJSON() as Record<string, unknown>);
    if (options.answer) return route.fulfill(options.answer as Parameters<typeof route.fulfill>[0]);
    return route.fulfill({ status: 200, json: options.page ?? CONSIGNOR() });
  });
  return calls;
}

/** The last digit completes the key, and the page opens by itself. */
async function typeKey(page: Page, digits: string) {
  await page.getByLabel('Digit 1 of 4').click();
  await page.keyboard.type(digits);
}

test('asks for the key of 4 digits, then shows the cards with the token only in the fragment', async ({
  page,
}) => {
  const calls = await consignorApi(page);
  await page.goto(`/consignor#token=${TOKEN}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Follow your card' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open' })).toBeDisabled();
  await typeKey(page, '5299');

  await expect(
    page.getByRole('heading', { level: 1, name: /Rafael, your cards at Card Hub/ }),
  ).toBeVisible();
  expect(calls.opened.at(0)).toEqual({ token: TOKEN, key: '5299' });
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('shows the live auction, the bids with hidden phones and the estimate', async ({ page }) => {
  await consignorApi(page);
  await page.goto(`/consignor#token=${TOKEN}`);
  await typeKey(page, '5299');

  const card = page.getByRole('region', { name: '#0431 Pikachu VMAX' });
  await expect(card).toContainText('044/185 · NM · PT · consigned by you');
  await expect(card).toContainText('In progress');
  await expect(card).toContainText(/R\$\s?465\.00/);
  await expect(card).toContainText('41 bids');
  await expect(card.getByRole('timer')).toContainText(/Ends in 00:4\d:\d\d/);
  await expect(card).toContainText('(11) 9••••-1020');
  await expect(card).toContainText('Phone numbers partly hidden');
  await expect(card).toContainText('Store commission (15.00%)');
  await expect(card).toContainText(/−\s?R\$\s?69\.75/);
  await expect(card).toContainText(/R\$\s?395\.25/);
  await expect(card).toContainText('The final value is set when the auction ends');
});

test('shows the other cards by their situation', async ({ page }) => {
  await consignorApi(page);
  await page.goto(`/consignor#token=${TOKEN}`);
  await typeKey(page, '5299');

  const mew = page.getByRole('region', { name: '#0301 Mew ex' });
  await expect(mew).toContainText('Sold');
  await expect(mew.getByRole('timer')).toHaveCount(0);
});

test('says the same thing for a wrong key and a link that does not work', async ({ page }) => {
  await consignorApi(page, { answer: problem(404, 'PUBLIC_LINK_NOT_FOUND') });
  await page.goto(`/consignor#token=${TOKEN}`);
  await typeKey(page, '0000');

  await expect(
    page.getByRole('alert').filter({ hasText: 'link is not available or the key is wrong' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Digit 1 of 4')).toHaveValue('');
});

test('says to wait when there were too many attempts', async ({ page }) => {
  await consignorApi(page, { answer: problem(429, 'RATE_LIMITED') });
  await page.goto(`/consignor#token=${TOKEN}`);
  await typeKey(page, '0000');

  await expect(page.getByRole('alert').filter({ hasText: 'Wait a few minutes' })).toBeVisible();
});

test('says there is nothing to ask without a token in the address', async ({ page }) => {
  const calls = await consignorApi(page);
  await page.goto('/consignor');

  await expect(page.getByRole('heading', { name: 'This link is not available' })).toBeVisible();
  expect(calls.opened).toEqual([]);
});

test('says when the consignor has no cards in the store', async ({ page }) => {
  await consignorApi(page, { page: { ...CONSIGNOR(), cards: [] } });
  await page.goto(`/consignor#token=${TOKEN}`);
  await typeKey(page, '5299');

  await expect(
    page.getByText('You have no cards consigned to this store right now.'),
  ).toBeVisible();
});

test('the follow-up fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await consignorApi(page);
  await page.goto(`/consignor#token=${TOKEN}`);
  await typeKey(page, '5299');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Rafael');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
