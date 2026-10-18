import { describe, expect, it } from 'vitest';
import { browserStoreStorage } from './store-storage';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  } as Storage;
}

describe('browserStoreStorage', () => {
  it('remembers the store and forgets it', () => {
    const backing = memoryStorage();
    const storage = browserStoreStorage(() => backing);

    storage.set('store-1');
    expect(storage.get()).toBe('store-1');
    storage.set(null);
    expect(storage.get()).toBeNull();
  });

  it('works without storage', () => {
    const storage = browserStoreStorage(() => undefined);
    storage.set('store-1');
    expect(storage.get()).toBeNull();
  });

  it('does not break when the storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const storage = browserStoreStorage(() => blocked);

    expect(() => storage.set('store-1')).not.toThrow();
    expect(() => storage.set(null)).not.toThrow();
    expect(storage.get()).toBeNull();
  });
});
