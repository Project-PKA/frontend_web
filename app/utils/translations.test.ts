import { describe, expect, it } from 'vitest';
import catalog from '../api/error-codes.json';
import en from '../../i18n/locales/en.json';
import ptBR from '../../i18n/locales/pt-BR.json';

type Tree = { [key: string]: string | Tree };

const locales: Record<string, Tree> = { en, 'pt-BR': ptBR };

/** Error kinds that do not come from the API (see `errorMessageKey`). */
const LOCAL_ERROR_KEYS = ['unknown', 'http', 'network', 'timeout', 'aborted', 'parse'];

const apiCodes = (catalog as { codes: { code: string }[] }).codes.map((item) => item.code);

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') entries.set(path, value);
    else for (const [nested, text] of flatten(value, path)) entries.set(nested, text);
  }
  return entries;
}

const flat = Object.fromEntries(
  Object.entries(locales).map(([name, tree]) => [name, flatten(tree)] as const),
);

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each(Object.keys(locales))('translations (%s)', (name) => {
  const messages = flat[name]!;

  it('translates every error code of the API', () => {
    const missing = apiCodes.filter((code) => !messages.get(`errors.${code}`)?.trim());
    expect(missing).toEqual([]);
  });

  it('has no translation for a code the API no longer sends', () => {
    const known = new Set([...apiCodes, ...LOCAL_ERROR_KEYS]);
    const stale = [...messages.keys()]
      .filter((key) => key.startsWith('errors.'))
      .map((key) => key.slice('errors.'.length))
      .filter((code) => !known.has(code));
    expect(stale).toEqual([]);
  });

  it('has no empty text', () => {
    const empty = [...messages].filter(([, text]) => text.trim() === '').map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('never uses wording of guarantee or the name of the card catalog (ADR 0013)', () => {
    const banned =
      /anti-?calote|compra segura|pagamento garantido|safe purchase|guaranteed|tcgdex/i;
    const offending = [...messages].filter(([, text]) => banned.test(text)).map(([key]) => key);
    expect(offending).toEqual([]);
  });
});

describe('translations of both languages', () => {
  it('have the same keys', () => {
    const english = [...flat.en!.keys()].sort();
    const portuguese = [...flat['pt-BR']!.keys()].sort();
    expect(portuguese).toEqual(english);
  });

  it('use the same placeholders in every message', () => {
    const different = [...flat.en!]
      .filter(([key, text]) => {
        const other = flat['pt-BR']!.get(key);
        return other !== undefined && placeholders(text).join() !== placeholders(other).join();
      })
      .map(([key]) => key);
    expect(different).toEqual([]);
  });
});

describe('error code catalog', () => {
  it('lists each code once', () => {
    expect(new Set(apiCodes).size).toBe(apiCodes.length);
  });

  it('is not empty', () => {
    expect(apiCodes.length).toBeGreaterThan(0);
  });
});
