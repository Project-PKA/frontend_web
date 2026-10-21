import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect } from '../e2e/fixtures';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8081';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/** The account of the owner in the seed (`shared/compose.yaml`). */
export const OWNER_EMAIL = 'dono@example.com';

interface MailpitMessage {
  ID: string;
  Created: string;
  To?: { Address: string }[];
}

/** Reads the six-digit code the API sent to an e-mail address, from the Mailpit inbox. */
export async function readLoginCode(email: string, since: number): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json()) as {
      messages?: MailpitMessage[];
    };
    const found = (list.messages ?? []).find(
      (message) =>
        message.To?.some((to) => to.Address === email) && Date.parse(message.Created) >= since,
    );
    if (found) {
      const full = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${found.ID}`)).json()) as {
        Text?: string;
        Subject?: string;
      };
      const code = /\b(\d{6})\b/.exec(`${full.Text ?? ''} ${full.Subject ?? ''}`)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No login code arrived in Mailpit for ${email}`);
}

/** Signs in through the login page, the way a person does, and lands on the store selection. */
export async function signIn(page: Page, email = OWNER_EMAIL) {
  const since = Date.now() - 2000;
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('Digit 1 of 6')).toBeFocused();
  const code = await readLoginCode(email, since);
  await page.keyboard.type(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/stores$/);
}

/**
 * The seed owner can have either language saved, so a test finds a text by its translation key in
 * both locale files instead of hard-coding one language.
 */
export function label(key: string, whole = true): RegExp {
  const texts = ['en', 'pt-BR'].map((locale) => {
    const messages = JSON.parse(
      readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
    ) as Record<string, unknown>;
    const text = key.split('.').reduce<unknown>((node, part) => (node as never)?.[part], messages);
    if (typeof text !== 'string') throw new Error(`No translation for ${key} in ${locale}`);
    return text;
  });
  const escape = (text: string) =>
    text
      .split(/\{\w+\}/)
      .map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`))
      .join('.*');
  const alternatives = texts.map(escape).join('|');
  return new RegExp(whole ? `^(${alternatives})$` : `(${alternatives})`);
}

/**
 * Picks a store on the selection screen. The first click can land before the page is hydrated
 * (the dev server compiles each route on first use), so it is repeated until the home opens.
 */
export async function chooseStore(page: Page, name: RegExp) {
  await expect(async () => {
    await page.getByRole('link', { name }).click({ timeout: 2000 });
    await expect(page).toHaveURL(/\/home$/, { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
}
