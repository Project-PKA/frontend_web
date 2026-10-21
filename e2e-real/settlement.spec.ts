import { expect, test } from '../e2e/fixtures';
import { chooseStore, label, signIn } from './helpers';

// Needs the seed (`docker compose run --rm seed`): it leaves a buyer waiting for a settlement, and
// this flow uses that buyer up, so run the seed again before a second run.
test('settles a buyer: the store makes the link, the buyer says they paid, the store confirms', async ({
  browser,
  page,
}) => {
  await signIn(page);
  await chooseStore(page, /Cartas do Zé/);

  // The store creates the settlement of a buyer who won cards and gets the link, which shows once.
  await page.goto('/settlements');
  const create = page.getByRole('button', { name: label('settlements.create.aria') }).first();
  await expect(create, 'the seed should leave a buyer waiting for a settlement').toBeVisible();
  const buyerName = (await create.getAttribute('aria-label'))?.split(/ (?:of|de) /).pop() ?? '';
  await create.click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toContainText('/settlement#token=');
  const link = /http\S*\/settlement#token=\S+/.exec(await dialog.innerText())?.[0];
  expect(link).toBeTruthy();
  await dialog
    .getByRole('button', { name: label('settlements.close') })
    .first()
    .click();

  // The buyer opens the link with no login, fills in the data and says they paid.
  const buyerContext = await browser.newContext();
  try {
    const buyer = await buyerContext.newPage();
    await buyer.goto(link as string);
    await expect(
      buyer.getByRole('heading', { level: 1, name: label('settlementPage.heading') }),
    ).toBeVisible({ timeout: 30_000 });

    await buyer.getByLabel(label('settlementPage.data.cpf')).fill('529.982.247-25');
    await buyer.getByLabel(label('settlementPage.data.zip')).fill('01310-100');
    await buyer.getByLabel(label('settlementPage.data.street')).fill('Avenida Paulista');
    await buyer.getByLabel(label('settlementPage.data.number')).fill('1000');
    await buyer.getByLabel(label('settlementPage.data.city')).fill('São Paulo');
    await buyer.getByLabel(label('settlementPage.data.state')).fill('SP');
    await buyer
      .locator('label.switch')
      .filter({ hasText: label('settlementPage.data.consent', false) })
      .click();
    await buyer.getByRole('button', { name: label('settlementPage.data.save') }).click();
    await expect(buyer.getByText(label('settlementPage.data.saved'))).toBeVisible();

    await buyer.getByRole('button', { name: label('settlementPage.pay.claim') }).click();
    await expect(buyer.getByText(label('settlementPage.pay.sent'))).toBeVisible();
    // The notice alone does not pay anything: the page still waits for the store.
    await expect(buyer.getByText(label('settlementPage.status.PENDING')).first()).toBeVisible();
  } finally {
    await buyerContext.close();
  }

  // The store sees the notice and is the one who confirms the payment.
  await page.goto('/settlements');
  await page.getByRole('tab', { name: label('settlements.tabs.pending') }).click();
  await expect(page.getByText(label('settlements.claimed')).first()).toBeVisible();
  await page
    .getByRole('button', { name: label('settlements.confirm.aria') })
    .filter({ hasText: '' })
    .first()
    .click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: label('customer.confirm.confirm') })
    .click();
  await expect(page.getByText(label('customer.confirm.done'))).toBeVisible();

  await page.getByRole('tab', { name: label('settlements.tabs.paid') }).click();
  await expect(page.getByRole('cell', { name: buyerName }).first()).toBeVisible();
});
