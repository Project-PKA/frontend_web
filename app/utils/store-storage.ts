/** Where the current store id is remembered between page loads. It is not a secret. */
export interface StoreStorage {
  get(): string | null;
  set(storeId: string | null): void;
}

const KEY = 'current-store';

/** Browser storage can be missing or blocked (private window): never let it break the app. */
export function browserStoreStorage(storage: () => Storage | undefined): StoreStorage {
  return {
    get() {
      try {
        return storage()?.getItem(KEY) ?? null;
      } catch {
        return null;
      }
    },
    set(storeId) {
      try {
        if (storeId === null) storage()?.removeItem(KEY);
        else storage()?.setItem(KEY, storeId);
      } catch {
        // Without storage the person just picks the store again after a reload.
      }
    },
  };
}
