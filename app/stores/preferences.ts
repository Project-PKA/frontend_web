import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createPreferencesApi, type Preferences, type PreferencesApi } from '../api/preferences';
import { createAppClient } from '../api/instance';
import { DEFAULT_LANGUAGE, detectLanguage, isLanguage, type Language } from '../utils/language';
import { browserTimeZone } from '../utils/format';
import { localSetting, type StoreStorage } from '../utils/store-storage';
import { DEFAULT_THEME, applyTheme as setDocumentTheme, isTheme, type Theme } from '../utils/theme';

export interface PreferencesDeps {
  getApi: () => PreferencesApi;
  /** Switches the interface language (the i18n module). */
  setLocale: (language: Language) => Promise<void>;
  /** Puts the theme on the page. */
  setTheme: (theme: Theme) => void;
  /** The language chosen by hand, remembered for people who are not logged in. */
  languageStorage: StoreStorage;
  themeStorage: StoreStorage;
  navigatorLanguages: () => readonly string[] | undefined;
  isAuthenticated: () => boolean;
}

/**
 * The interface language, the theme and the profile preferences. Order of
 * precedence: what is saved in the profile (when logged in), then what was chosen by
 * hand on this device, then the browser's language and the system theme.
 */
export function definePreferencesStore(deps: PreferencesDeps, id = 'preferences') {
  return defineStore(id, () => {
    const language = ref<Language>(DEFAULT_LANGUAGE);
    const theme = ref<Theme>(DEFAULT_THEME);
    const profile = ref<Preferences | null>(null);
    let initialized = false;
    let themeInitialized = false;

    const timezone = computed(() => profile.value?.timezone ?? browserTimeZone());
    const currency = computed(() => profile.value?.currency ?? 'BRL');

    async function applyLanguage(next: Language) {
      language.value = next;
      await deps.setLocale(next);
    }

    function applyTheme(next: Theme) {
      theme.value = next;
      deps.setTheme(next);
    }

    /** Picks the first language for the app pages: chosen by hand, or the browser's. */
    async function init() {
      if (initialized) return;
      initialized = true;
      const stored = deps.languageStorage.get();
      await applyLanguage(isLanguage(stored) ? stored : detectLanguage(deps.navigatorLanguages()));
    }

    /** Puts the theme chosen on this device on the page; the system theme otherwise. */
    function initTheme() {
      if (themeInitialized) return;
      themeInitialized = true;
      const stored = deps.themeStorage.get();
      applyTheme(isTheme(stored) ? stored : DEFAULT_THEME);
    }

    /** Loads the profile preferences. What is saved there wins over this device. */
    async function load() {
      profile.value = await deps.getApi().get();
      deps.languageStorage.set(profile.value.language);
      deps.themeStorage.set(profile.value.theme);
      applyTheme(profile.value.theme);
      await applyLanguage(profile.value.language);
    }

    /**
     * Changes the language by hand. When logged in it is saved in the profile;
     * if saving fails the previous language comes back and the error is thrown.
     */
    async function changeLanguage(next: Language) {
      const previous = language.value;
      await applyLanguage(next);
      deps.languageStorage.set(next);
      if (!deps.isAuthenticated()) return;
      try {
        profile.value = await deps.getApi().update({ language: next });
      } catch (error) {
        await applyLanguage(previous);
        deps.languageStorage.set(previous);
        throw error;
      }
    }

    /** Same as `changeLanguage`, for the theme. */
    async function changeTheme(next: Theme) {
      const previous = theme.value;
      applyTheme(next);
      deps.themeStorage.set(next);
      if (!deps.isAuthenticated()) return;
      try {
        profile.value = await deps.getApi().update({ theme: next });
      } catch (error) {
        applyTheme(previous);
        deps.themeStorage.set(previous);
        throw error;
      }
    }

    /** Forgets the profile (after logout); the language and the theme on screen stay. */
    function clearProfile() {
      profile.value = null;
    }

    return {
      language,
      theme,
      profile,
      timezone,
      currency,
      init,
      initTheme,
      load,
      changeLanguage,
      changeTheme,
      clearProfile,
    };
  });
}

const browserStorage = () => (import.meta.client ? localStorage : undefined);

export const usePreferencesStore = definePreferencesStore({
  getApi: () => {
    const access = useAccessStore();
    return createPreferencesApi(
      createAppClient({
        getStoreId: () => access.storeId,
        onForbidden: (action) => handleForbidden(action, () => access.clearStore()),
      }),
    );
  },
  setLocale: (language) => useNuxtApp().$i18n.setLocale(language),
  setTheme: (theme) => setDocumentTheme(theme, document.documentElement),
  languageStorage: localSetting('language', browserStorage),
  themeStorage: localSetting('theme', browserStorage),
  navigatorLanguages: () => (import.meta.client ? navigator.languages : undefined),
  isAuthenticated: () => useSessionStore().isAuthenticated,
});
