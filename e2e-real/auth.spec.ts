import { expect, test } from '../e2e/fixtures';
import { signIn } from './helpers';

test('signs in with the code read from the real inbox and picks a store', async ({ page }) => {
  await signIn(page);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'test-results/real-stores.png' });
});
