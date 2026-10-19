import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences, PreferencesApi } from '../api/preferences';
import { ApiError } from '../api/errors';
import type { Language } from '../utils/language';
import type { StoreStorage } from '../utils/store-storage';
import { definePreferencesStore } from './preferences';

function profile(overrides: Partial<Preferences> = {}): Preferences {
  return {
    language: 'en',
    theme: 'SYSTEM',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    notifications: { in_app: true, email: true },
    ...overrides,
  };
}

function memoryStorage(initial: string | null = null) {
  const box = { value: initial };
  const storage: StoreStorage = {
    get: () => box.value,
    set: (next) => {
      box.value = next;
    },
  };
  return storage;
}

function setup(
  options: {
    stored?: string | null;
    browser?: string[];
    authenticated?: boolean;
    api?: Partial<Record<keyof PreferencesApi, unknown>>;
  } = {},
) {
  const applied: Language[] = [];
  const api = {
    get: vi.fn().mockResolvedValue(profile({ language: 'pt-BR' })),
    update: vi
      .fn()
      .mockImplementation((changes: { language?: Language }) =>
        Promise.resolve(profile({ language: changes.language ?? 'en' })),
      ),
    ...options.api,
  } as unknown as PreferencesApi & Record<keyof PreferencesApi, ReturnType<typeof vi.fn>>;
  const languageStorage = memoryStorage(options.stored ?? null);

  setActivePinia(createPinia());
  const store = definePreferencesStore({
    getApi: () => api,
    setLocale: (language) => {
      applied.push(language);
      return Promise.resolve();
    },
    languageStorage,
    navigatorLanguages: () => options.browser ?? ['en-US'],
    isAuthenticated: () => options.authenticated ?? false,
  })();

  return { store, api, applied, languageStorage };
}

describe('preferences store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts with the browser language', async () => {
    const { store, applied } = setup({ browser: ['pt-BR', 'en'] });
    await store.init();
    expect(applied).toEqual(['pt-BR']);
    expect(store.language).toBe('pt-BR');
  });

  it('prefers the language chosen by hand to the browser language', async () => {
    const { store, applied } = setup({ stored: 'en', browser: ['pt-BR'] });
    await store.init();
    expect(applied).toEqual(['en']);
  });

  it('ignores a stored value that is not a supported language', async () => {
    const { store, applied } = setup({ stored: 'klingon', browser: ['pt-BR'] });
    await store.init();
    expect(applied).toEqual(['pt-BR']);
  });

  it('picks the first language only once', async () => {
    const { store, applied } = setup();
    await store.init();
    await store.init();
    expect(applied).toHaveLength(1);
  });

  it('lets the language saved in the profile win over this device', async () => {
    const { store, applied, languageStorage } = setup({ stored: 'en' });
    await store.init();

    await store.load();

    expect(applied).toEqual(['en', 'pt-BR']);
    expect(store.language).toBe('pt-BR');
    expect(languageStorage.get()).toBe('pt-BR');
    expect(store.timezone).toBe('America/Sao_Paulo');
    expect(store.currency).toBe('BRL');
  });

  it('changes the language by hand and remembers it without saving it when logged out', async () => {
    const { store, api, languageStorage } = setup({ authenticated: false });

    await store.changeLanguage('pt-BR');

    expect(store.language).toBe('pt-BR');
    expect(languageStorage.get()).toBe('pt-BR');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('saves the language in the profile when logged in', async () => {
    const { store, api } = setup({ authenticated: true });

    await store.changeLanguage('pt-BR');

    expect(api.update).toHaveBeenCalledWith({ language: 'pt-BR' });
    expect(store.profile?.language).toBe('pt-BR');
  });

  it('goes back to the previous language when saving fails', async () => {
    const failing = vi.fn().mockRejectedValue(new ApiError('network'));
    const { store, applied, languageStorage } = setup({
      authenticated: true,
      stored: 'en',
      api: { update: failing },
    });
    await store.init();

    await expect(store.changeLanguage('pt-BR')).rejects.toMatchObject({ kind: 'network' });

    expect(store.language).toBe('en');
    expect(applied.at(-1)).toBe('en');
    expect(languageStorage.get()).toBe('en');
  });

  it('forgets the profile but keeps the language on screen', async () => {
    const { store } = setup();
    await store.load();

    store.clearProfile();

    expect(store.profile).toBeNull();
    expect(store.language).toBe('pt-BR');
  });

  it('falls back to the browser time zone and to BRL without a profile', () => {
    const { store } = setup();
    expect(store.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(store.currency).toBe('BRL');
  });
});
