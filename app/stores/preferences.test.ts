import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preferences, PreferencesApi } from '../api/preferences';
import { ApiError } from '../api/errors';
import type { Language } from '../utils/language';
import type { Theme } from '../utils/theme';
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
    storedTheme?: string | null;
    browser?: string[];
    authenticated?: boolean;
    api?: Partial<Record<keyof PreferencesApi, unknown>>;
  } = {},
) {
  const applied: Language[] = [];
  const themes: Theme[] = [];
  const api = {
    get: vi.fn().mockResolvedValue(profile({ language: 'pt-BR' })),
    update: vi
      .fn()
      .mockImplementation((changes: { language?: Language; theme?: Theme }) =>
        Promise.resolve(
          profile({ language: changes.language ?? 'en', theme: changes.theme ?? 'SYSTEM' }),
        ),
      ),
    ...options.api,
  } as unknown as PreferencesApi & Record<keyof PreferencesApi, ReturnType<typeof vi.fn>>;
  const languageStorage = memoryStorage(options.stored ?? null);
  const themeStorage = memoryStorage(options.storedTheme ?? null);

  setActivePinia(createPinia());
  const store = definePreferencesStore({
    getApi: () => api,
    setLocale: (language) => {
      applied.push(language);
      return Promise.resolve();
    },
    setTheme: (theme) => void themes.push(theme),
    languageStorage,
    themeStorage,
    navigatorLanguages: () => options.browser ?? ['en-US'],
    isAuthenticated: () => options.authenticated ?? false,
  })();

  return { store, api, applied, themes, languageStorage, themeStorage };
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

  it('saves the other preferences and keeps what the server answered', async () => {
    const update = vi
      .fn()
      .mockResolvedValue(
        profile({ timezone: 'America/Manaus', notifications: { in_app: true, email: false } }),
      );
    const { store, api } = setup({ authenticated: true, api: { update } });

    await store.saveProfile({ timezone: 'America/Manaus', notifications: { email: false } });

    expect(api.update).toHaveBeenCalledWith({
      timezone: 'America/Manaus',
      notifications: { email: false },
    });
    expect(store.timezone).toBe('America/Manaus');
    expect(store.profile?.notifications.email).toBe(false);
  });

  it('keeps the profile as it was when saving fails', async () => {
    const update = vi.fn().mockRejectedValue(new ApiError('network'));
    const { store } = setup({ authenticated: true, api: { update } });
    await store.load();

    await expect(store.saveProfile({ timezone: 'America/Manaus' })).rejects.toMatchObject({
      kind: 'network',
    });

    expect(store.timezone).toBe('America/Sao_Paulo');
  });

  it('forgets the profile but keeps the language on screen', async () => {
    const { store } = setup();
    await store.load();

    store.clearProfile();

    expect(store.profile).toBeNull();
    expect(store.language).toBe('pt-BR');
  });

  it('starts with the system theme', () => {
    const { store, themes } = setup();
    store.initTheme();
    expect(themes).toEqual(['SYSTEM']);
    expect(store.theme).toBe('SYSTEM');
  });

  it('starts with the theme chosen on this device', () => {
    const { store, themes } = setup({ storedTheme: 'DARK' });
    store.initTheme();
    expect(themes).toEqual(['DARK']);
  });

  it('ignores a stored theme that does not exist', () => {
    const { store, themes } = setup({ storedTheme: 'NEON' });
    store.initTheme();
    expect(themes).toEqual(['SYSTEM']);
  });

  it('puts the starting theme on the page only once', () => {
    const { store, themes } = setup();
    store.initTheme();
    store.initTheme();
    expect(themes).toHaveLength(1);
  });

  it('lets the theme saved in the profile win over this device', async () => {
    const saved = vi.fn().mockResolvedValue(profile({ theme: 'LIGHT' }));
    const { store, themes, themeStorage } = setup({ storedTheme: 'DARK', api: { get: saved } });
    store.initTheme();

    await store.load();

    expect(themes).toEqual(['DARK', 'LIGHT']);
    expect(store.theme).toBe('LIGHT');
    expect(themeStorage.get()).toBe('LIGHT');
  });

  it('changes the theme by hand without saving it when logged out', async () => {
    const { store, api, themeStorage, themes } = setup({ authenticated: false });

    await store.changeTheme('DARK');

    expect(themes).toEqual(['DARK']);
    expect(themeStorage.get()).toBe('DARK');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('saves the theme in the profile when logged in', async () => {
    const { store, api } = setup({ authenticated: true });

    await store.changeTheme('LIGHT');

    expect(api.update).toHaveBeenCalledWith({ theme: 'LIGHT' });
    expect(store.profile?.theme).toBe('LIGHT');
  });

  it('goes back to the previous theme when saving fails', async () => {
    const failing = vi.fn().mockRejectedValue(new ApiError('network'));
    const { store, themes, themeStorage } = setup({
      authenticated: true,
      storedTheme: 'DARK',
      api: { update: failing },
    });
    store.initTheme();

    await expect(store.changeTheme('LIGHT')).rejects.toMatchObject({ kind: 'network' });

    expect(store.theme).toBe('DARK');
    expect(themes.at(-1)).toBe('DARK');
    expect(themeStorage.get()).toBe('DARK');
  });

  it('falls back to the browser time zone and to BRL without a profile', () => {
    const { store } = setup();
    expect(store.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(store.currency).toBe('BRL');
  });
});
