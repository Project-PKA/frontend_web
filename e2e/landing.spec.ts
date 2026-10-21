import { expect, test } from './fixtures';

test('shows the sections of the design, in English', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Pokémon card auctions on WhatsApp',
  );
  for (const name of [
    'A Pokémon card auction in four steps',
    'Everything for people who sell Pokémon cards',
    'Your live auctions, in plain sight',
    'Operations and finance, each in its place',
    'Choose the plan of your store',
    'Made for people who sell cards in groups',
    'Get your questions answered',
    'Ready to organize your auctions?',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  await expect(page.getByRole('listitem').filter({ hasText: 'Register the card' })).toBeVisible();
  await expect(page.locator('#funcionalidades article')).toHaveCount(8);
});

test('is available in Brazilian Portuguese with the same sections', async ({ page }) => {
  await page.goto('/pt-BR/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Leilões de cartas Pokémon');
  await expect(page.getByRole('heading', { level: 2, name: 'Tire suas dúvidas' })).toBeVisible();
  await expect(page.locator('#funcionalidades article')).toHaveCount(8);
});

test('switches the language through the footer links', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Português (Brasil)' }).click();
  await expect(page).toHaveURL(/\/pt-BR\/?$/);
  await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute('hreflang', 'en');
});

test('opens and closes the questions, one by one', async ({ page }) => {
  await page.goto('/');

  const first = page.locator('details').first();
  await expect(first).not.toHaveAttribute('open', '');
  await first.getByText('How do I get started?').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(first.getByText('Access is by invitation only')).toBeVisible();
  await first.getByText('How do I get started?').click();
  await expect(first).not.toHaveAttribute('open', '');
});

test('leads to the access request and to the login', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Request access' }).first()).toHaveAttribute(
    'href',
    '/request-access',
  );
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute(
    'href',
    '/login',
  );
  await page.getByRole('link', { name: 'Request access' }).first().click();
  await expect(page).toHaveURL(/\/request-access$/);
});

test('the menu links go to the sections', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Questions' })
    .click();
  await expect(page).toHaveURL(/#faq$/);
  await expect(page.getByRole('heading', { name: 'Get your questions answered' })).toBeInViewport();
});

test('describes itself to search engines: structured data, no guarantee language', async ({
  page,
}) => {
  await page.goto('/');

  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  );
  expect(data['@graph'].map((item: { '@type': string }) => item['@type'])).toEqual([
    'SoftwareApplication',
    'FAQPage',
  ]);
  expect(data['@graph'][1].mainEntity).toHaveLength(7);

  const text = (await page.locator('main').innerText()).toLowerCase();
  for (const forbidden of ['anti-calote', 'compra segura', 'guaranteed', 'risk-free']) {
    expect(text).not.toContain(forbidden);
  }
});

test('keeps the one h1 and the headings in order', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const levels = await page
    .locator('h1, h2, h3')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
  levels.reduce((previous, level) => {
    expect(level - previous).toBeLessThanOrEqual(1);
    return level;
  }, 0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('shows the showcase, the dashboards and the plans without prices or promises', async ({
  page,
}) => {
  await page.goto('/');

  const showcase = page.locator('#vitrine');
  await expect(
    showcase.getByRole('article', { name: 'Example of an auction on the showcase' }),
  ).toBeVisible();
  await expect(showcase).toContainText('* example image');
  const dashboards = page.locator('#dashboards');
  await expect(dashboards.getByRole('img', { name: 'Example bar chart' })).toBeVisible();
  await expect(dashboards).toContainText('* example data');

  const plans = page.locator('#precos');
  await expect(plans.getByRole('heading', { level: 3 })).toHaveText([
    'Starter',
    'Store',
    'Network',
  ]);
  await expect(plans).toContainText('Plans and prices are being defined');
  await expect(plans.getByText('Price to be defined')).toHaveCount(3);
  await expect(plans.getByText(/R\$/)).toHaveCount(0);
  for (const link of await plans.getByRole('link', { name: 'Request access' }).all()) {
    await expect(link).toHaveAttribute('href', '/request-access');
  }
});

test('the menu reaches the new sections', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.getByRole('link', { name: 'Showcase' })).toHaveAttribute('href', '#vitrine');
  await expect(nav.getByRole('link', { name: 'Dashboards' })).toHaveAttribute(
    'href',
    '#dashboards',
  );
  await expect(nav.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#precos');
});
