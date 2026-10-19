/** A small value remembered between page loads, e.g. the current store id. Never a secret. */
export interface StoreStorage {
  get(): string | null;
  set(value: string | null): void;
}

/** Browser storage can be missing or blocked (private window): never let it break the app. */
export function localSetting(key: string, storage: () => Storage | undefined): StoreStorage {
  return {
    get() {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(value) {
      try {
        if (value === null) storage()?.removeItem(key);
        else storage()?.setItem(key, value);
      } catch {
        // Without storage the choice just is not remembered after a reload.
      }
    },
  };
}

export function browserStoreStorage(storage: () => Storage | undefined): StoreStorage {
  return localSetting('current-store', storage);
}
