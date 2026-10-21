import { expect, test } from '../e2e/fixtures';
import { chooseStore, label, signIn } from './helpers';

/** The value of a `datetime-local` field some days from now, so the end is always in the future. */
function inDays(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T12:00`;
}

// Leaves the stock as it found it: the auction is cancelled at the end and the card goes back.
test('launches an auction, opens its room and cancels it', async ({ page }) => {
  await signIn(page);
  await chooseStore(page, /Cartas do Zé/);

  await page.goto('/auctions');
  await page.getByRole('button', { name: label('auctions.new') }).click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('combobox', { name: label('auctions.create.card.label') }).fill('mewtwo');
  await page
    .getByRole('option', { name: /Mewtwo/ })
    .first()
    .click();
  await dialog.getByRole('button', { name: label('auctions.create.when.now') }).click();
  await dialog.getByLabel(label('auctions.terms.end')).fill(inDays(3));
  await dialog.getByLabel(label('auctions.terms.initial')).fill('25,50');
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/v1/auctions') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: label('auctions.create.launch') }).click();
  const auction = (await (await created).json()) as { id: string; status: string };
  expect(auction.status).toBe('ACTIVE');
  await expect(dialog).toBeHidden();

  // The room of the new auction opens with no bids yet.
  await page.goto(`/auctions/${auction.id}`);
  await expect(page.getByText(label('auctionRoom.noBids')).first()).toBeVisible();

  // Cancelling asks for confirmation, and the auction moves to the cancelled tab.
  await page.getByRole('link', { name: label('auctionRoom.edit') }).click();
  await page.getByRole('button', { name: label('auctionEdit.cancel') }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: label('auctionEdit.confirm.cancel') })
    .click();
  await expect(page.getByText(label('auctionEdit.cancelled'))).toBeVisible();

  await page.goto('/auctions');
  await page.getByRole('tab', { name: label('auctions.tabs.cancelled') }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Mewtwo' }).first()).toBeVisible();
});
