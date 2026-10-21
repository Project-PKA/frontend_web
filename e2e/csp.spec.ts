import { resolve } from 'node:path';
import { expect, test } from './fixtures';
// @ts-expect-error The script is plain JavaScript for the build, with no type declarations.
import { buildCsp, buildHashes } from '../scripts/csp.mjs';

const origin = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

const POLICY: string = buildCsp({
  hashes: buildHashes(resolve('.output/public')),
  apiOrigin: origin,
});

const PAGES = ['/', '/pt-BR', '/login', '/request-access', '/showcase', '/terms', '/privacy'];

for (const path of PAGES) {
  test(`${path} runs under the policy of the build, with no violation`, async ({ page }) => {
    // The static server sends no headers, so the policy is added to the pages like the proxy does.
    await page.route(
      (url) => url.origin === origin,
      async (route) => {
        const response = await route.fetch();
        if (route.request().resourceType() !== 'document') return route.fulfill({ response });
        return route.fulfill({
          response,
          headers: { ...response.headers(), 'content-security-policy': POLICY },
        });
      },
    );
    await page.route(/\/v1\/public\/showcase/, (route) =>
      route.fulfill({ status: 200, json: { items: [], total: 0, stores: [] } }),
    );
    await page.addInitScript(() => {
      (window as unknown as { __violations: string[] }).__violations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __violations: string[] }).__violations.push(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });
    const errors: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) errors.push(message.text());
    });

    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    const hydrated = await page.evaluate(() => {
      const app = (
        window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }
      ).useNuxtApp?.();
      return app !== undefined && !app.isHydrating;
    });
    expect(hydrated).toBe(true);
    expect(
      await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}
