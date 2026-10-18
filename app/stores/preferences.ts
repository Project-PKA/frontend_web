import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createPreferencesApi, type Preferences, type PreferencesApi } from '../api/preferences';
import { createAppClient } from '../api/instance';
import { DEFAULT_LANGUAGE, detectLanguage, isLanguage, type Language } from '../utils/language';
import { browserTimeZone } from '../utils/format';
import { localSetting, type StoreStorage } from '../utils/store-storage';

export interface PreferencesDeps {
  getApi: () => PreferencesApi;
  /** Switches the interface language (the i18n module). */
  setLocale: (language: Language) => Promise<void>;
  /** The language chosen by hand, remembered for people who are not logged in. */
  languageStorage: StoreStorage;
  navigatorLanguages: () => readonly string[] | undefined;
  isAuthenticated: () => boolean;
}

/**
 * The interface language and the profile preferences. Order of precedence for
 * the app pages: the language saved in the profile (when logged in), then the
 * one chosen by hand on this device, then the browser's language.
 */
export function definePreferencesStore(deps: PreferencesDeps, id = 'preferences') {
  return defineStore(id, () => {
    const language = ref<Language>(DEFAULT_LANGUAGE);
    const profile = ref<Preferences | null>(null);
    let initialized = false;

    const timezone = computed(() => profile.value?.timezone ?? browserTimeZone());
    const currency = computed(() => profile.value?.currency ?? 'BRL');

    async function applyLanguage(next: Language) {
      language.value = next;
      await deps.setLocale(next);
    }

    /** Picks the first language for the app pages: chosen by hand, or the browser's. */
    async function init() {
      if (initialized) return;
      initialized = true;
      const stored = deps.languageStorage.get();
      await applyLanguage(isLanguage(stored) ? stored : detectLanguage(deps.navigatorLanguages()));
    }

    /** Loads the profile preferences. The language saved there wins over this device. */
    async function load() {
      profile.value = await deps.getApi().get();
      deps.languageStorage.set(profile.value.language);
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

    /** Forgets the profile (after logout); the language on screen stays. */
    function clearProfile() {
      profile.value = null;
    }

    return { language, profile, timezone, currency, init, load, changeLanguage, clearProfile };
  });
}

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
  languageStorage: localSetting('language', () => (import.meta.client ? localStorage : undefined)),
  navigatorLanguages: () => (import.meta.client ? navigator.languages : undefined),
  isAuthenticated: () => useSessionStore().isAuthenticated,
});
