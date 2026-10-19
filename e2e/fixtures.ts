import { expect, test as base, type Page } from '@playwright/test';

/**
 * Some pages (the landing, the login, request access) come as HTML from the build and are
 * hydrated by the JavaScript a moment later. A button clicked in between does nothing, which
 * is harmless for a person but makes a test flaky: wait until Nuxt has hydrated the page.
 */
async function waitForHydration(page: Page) {
  await page
    .waitForFunction(
      () => {
        const app = (
          window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }
        ).useNuxtApp?.();
        return app !== undefined && !app.isHydrating;
      },
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (...args: Parameters<Page['goto']>) => {
      const response = await goto(...args);
      await waitForHydration(page);
      return response;
    };
    await use(page);
  },
});

export { expect };
