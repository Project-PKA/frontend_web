import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const GROUP = 'https://chat.whatsapp.com/AbCdEfGhIj12';

function item(code: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    store: { id: 's-1', name: 'Card Hub', city: 'São Paulo', group_url: GROUP },
    card: {
      short_code: code,
      name,
      number: '199/165',
      set_name: '151',
      condition: 'NM',
      language: 'EN',
      is_foil: false,
      image_url: null,
    },
    current_bid: '820.00',
    bid_count: 54,
    last_bid_at: new Date(Date.now() - 8_000).toISOString(),
    ends_at: new Date(Date.now() + 12 * 60_000 + 40_000).toISOString(),
    ...extra,
  };
}

const PAGE = (count = 3, extra: Record<string, unknown>[] = []) => ({
  items: [
    item('0431', 'Charizard ex'),
    item('0432', 'Pikachu VMAX', {
      store: { id: 's-2', name: 'Cards do Zé', city: null, group_url: GROUP },
      current_bid: null,
      bid_count: 0,
    }),
    item('0433', 'Mew ex', {
      store: { id: 's-1', name: 'Card Hub', city: null, group_url: 'https://evil.example.com/x' },
    }),
    ...extra,
  ].slice(0, Math.max(count, 0)),
  total: count,
  stores: [
    { id: 's-1', name: 'Card Hub' },
    { id: 's-2', name: 'Cards do Zé' },
  ],
});

interface Options {
  page?: object;
  status?: number;
  /** A second page, for the button "Show more". */
  second?: object;
}

async function showcaseApi(page: Page, options: Options = {}) {
  const calls = { queries: [] as URLSearchParams[], headers: [] as Record<string, string>[] };
  await page.route(/\/v1\/public\/showcase/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    calls.queries.push(params);
    calls.headers.push(route.request().headers());
    if (options.status) {
      return route.fulfill({
        status: options.status,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Error', status: options.status, code: 'INTERNAL' },
      });
    }
    if (params.get('offset') !== '0' && options.second) {
      return route.fulfill({ status: 200, json: options.second });
    }
    return route.fulfill({ status: 200, json: options.page ?? PAGE() });
  });
  return calls;
}

test('shows the live auctions with the highest bid, the time left and the way to the group', async ({
  page,
}) => {
  const calls = await showcaseApi(page);
  await page.goto('/showcase');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Live auctions right now' }),
  ).toBeVisible();
  await expect(page.getByText('3 happening')).toBeVisible();
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(3);
  const first = cards.filter({ hasText: 'Charizard ex' });
  await expect(first).toContainText('Card Hub');
  await expect(first).toContainText('151 · NM · EN');
  await expect(first).toContainText(/R\$\s?820\.00/);
  await expect(first).toContainText('54 bids');
  await expect(first.getByRole('timer')).toContainText(/Ends in 00:1[0-2]:\d\d/);
  const go = first.getByRole('link', { name: 'Go to the auction' });
  await expect(go).toHaveAttribute('href', GROUP);
  await expect(go).toHaveAttribute('target', '_blank');
  await expect(go).toHaveAttribute('rel', /noopener/);
  // No session goes to the API.
  expect(calls.headers[0]?.authorization).toBeUndefined();
  expect(calls.queries[0]?.get('sort')).toBe('ENDING_SOON');
});

test('says there are no bids yet, and offers the group only when the link is a real invitation', async ({
  page,
}) => {
  await showcaseApi(page);
  await page.goto('/showcase');

  const pikachu = page.getByRole('article').filter({ hasText: 'Pikachu VMAX' });
  await expect(pikachu).toContainText('No bids yet');
  const mew = page.getByRole('article').filter({ hasText: 'Mew ex' });
  await expect(mew.getByRole('link', { name: 'Go to the auction' })).toHaveCount(0);
});

test('shows a placeholder when the card has no art', async ({ page }) => {
  await showcaseApi(page);
  await page.goto('/showcase');

  await expect(page.getByText('[ card photo ]').first()).toBeVisible();
});

test('shows the art of the catalog only from a secure address, without a referrer', async ({
  page,
}) => {
  await showcaseApi(page, {
    page: {
      ...PAGE(1),
      items: [
        item('0431', 'Charizard ex', {
          card: {
            short_code: '0431',
            name: 'Charizard ex',
            number: '199/165',
            set_name: '151',
            condition: 'NM',
            language: 'EN',
            is_foil: false,
            image_url: 'https://assets.example.com/low.webp',
          },
        }),
      ],
    },
  });
  await page.route('https://assets.example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.alloc(8) }),
  );
  await page.goto('/showcase');

  const art = page.getByRole('img', { name: 'Charizard ex' });
  await expect(art).toHaveAttribute('src', 'https://assets.example.com/low.webp');
  await expect(art).toHaveAttribute('referrerpolicy', 'no-referrer');
});

test('filters by store, language and sort, keeping them in the address', async ({ page }) => {
  const calls = await showcaseApi(page);
  await page.goto('/showcase');

  await page.getByLabel('Store', { exact: true }).selectOption('s-2');
  await expect(page).toHaveURL(/store=s-2/);
  await expect.poll(() => calls.queries.at(-1)?.get('store')).toBe('s-2');

  await page.getByLabel('Language', { exact: true }).selectOption('PT');
  await expect.poll(() => calls.queries.at(-1)?.get('language')).toBe('PT');

  await page.getByLabel('Sort by').selectOption('HIGHEST_BID');
  await expect(page).toHaveURL(/sort=HIGHEST_BID/);
  await expect.poll(() => calls.queries.at(-1)?.get('sort')).toBe('HIGHEST_BID');
});

test('opens with the filters of the address and ignores what the API does not know', async ({
  page,
}) => {
  const calls = await showcaseApi(page);
  await page.goto('/showcase?language=XX&sort=BAD');

  await expect(page.getByRole('article').first()).toBeVisible();
  expect(calls.queries[0]?.get('language')).toBeNull();
  expect(calls.queries[0]?.get('sort')).toBe('ENDING_SOON');
});

test('shows more auctions by offset', async ({ page }) => {
  const full = {
    items: Array.from({ length: 24 }, (_, index) => item(`0${100 + index}`, `Card ${index}`)),
    total: 25,
    stores: [{ id: 's-1', name: 'Card Hub' }],
  };
  const calls = await showcaseApi(page, {
    page: full,
    second: { items: [item('0999', 'Last card')], total: 25, stores: full.stores },
  });
  await page.goto('/showcase');

  await expect(page.getByRole('article')).toHaveCount(24);
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByRole('article')).toHaveCount(25);
  expect(calls.queries.at(-1)?.get('offset')).toBe('24');
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
});

test('says when no auction is live', async ({ page }) => {
  await showcaseApi(page, { page: { items: [], total: 0, stores: [] } });
  await page.goto('/showcase');

  await expect(page.getByRole('heading', { name: 'No live auctions right now' })).toBeVisible();
});

test('shows an error with a way to try again', async ({ page }) => {
  await showcaseApi(page, { status: 400 });
  await page.goto('/showcase');

  await expect(page.getByText('We could not load the auctions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('is open to anyone, with the way in and a request for access', async ({ page }) => {
  await showcaseApi(page);
  await page.goto('/showcase');

  await expect(page.getByRole('link', { name: 'Request access' })).toHaveAttribute(
    'href',
    '/request-access',
  );
});

test('the landing leads to the showcase', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.locator('#vitrine').getByRole('link', { name: 'Open the showcase' }),
  ).toHaveAttribute('href', '/showcase');
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await showcaseApi(page);
  await page.goto('/showcase');
  await expect(page.getByRole('article').first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// ------------------------------------------------------------ legal pages

test('shows the terms of use, in English and in Portuguese, with the notice', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Illustrative text, pending legal review');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(6);
  await expect(page.getByText('does not make sales, does not process payments')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
    'href',
    '/privacy',
  );

  await page.goto('/pt-BR/terms');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
    'href',
    '/pt-BR/privacy',
  );
});

test('shows the privacy policy, with the rights of the person and the encrypted CPF', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(7);
  await expect(page.getByText(/CPF is stored encrypted and shown masked/)).toBeVisible();
  await expect(page.getByText('We do not sell personal data.', { exact: false })).toBeVisible();
});

test('the footer of the landing links the terms and the privacy policy', async ({ page }) => {
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Terms of use' })).toHaveAttribute(
    'href',
    '/terms',
  );
  await expect(footer.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
    'href',
    '/privacy',
  );
});

test('the legal pages fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/terms', '/privacy']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
