import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessApi, CurrentStore, Me } from '../api/access';
import type { StoreStorage } from '../utils/store-storage';
import { defineAccessStore } from './access';

const me: Me = {
  id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10',
  email: 'igor@example.com',
  name: null,
  is_platform_admin: false,
  can_create_stores: true,
  store_limit: 2,
};

function currentStore(overrides: Partial<CurrentStore> = {}): CurrentStore {
  return {
    id: 'store-1',
    name: 'Card Hub',
    whatsapp_status: 'ONLINE',
    role: 'STAFF',
    permissions: { can_manage_auctions: true, can_view_finance: false },
    ...overrides,
  };
}

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: StoreStorage = {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
  return storage;
}

function setup(options: { api?: Partial<AccessApi>; storage?: StoreStorage } = {}) {
  const api = {
    getMe: vi.fn().mockResolvedValue(me),
    getStore: vi.fn().mockResolvedValue(currentStore()),
    ...options.api,
  } as unknown as AccessApi & {
    getMe: ReturnType<typeof vi.fn>;
    getStore: ReturnType<typeof vi.fn>;
  };
  const storage = options.storage ?? memoryStorage();
  setActivePinia(createPinia());
  return { api, storage, access: defineAccessStore(() => api, storage)() };
}

describe('access store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts with the store that was remembered', () => {
    expect(setup({ storage: memoryStorage('store-9') }).access.storeId).toBe('store-9');
  });

  it('loads the profile once', async () => {
    const { access, api } = setup();

    await access.loadMe();
    await access.loadMe();

    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(access.canCreateStores).toBe(true);
    expect(access.isPlatformAdmin).toBe(false);
  });

  it('reloads the profile when asked to', async () => {
    const { access, api } = setup();
    await access.loadMe();
    await access.loadMe(true);
    expect(api.getMe).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a chosen store', async () => {
    const { access, api } = setup();
    await access.loadStore();
    expect(api.getStore).not.toHaveBeenCalled();
    expect(access.role).toBeNull();
  });

  it('loads the role and permissions of the chosen store', async () => {
    const { access, api } = setup({ storage: memoryStorage('store-1') });

    await access.loadStore();
    await access.loadStore();

    expect(api.getStore).toHaveBeenCalledTimes(1);
    expect(access.role).toBe('STAFF');
    expect(access.can('can_manage_auctions')).toBe(true);
    expect(access.can('can_view_finance')).toBe(false);
    expect(access.can('can_delete')).toBe(false);
  });

  it('lets the owner do everything', async () => {
    const owner = vi.fn().mockResolvedValue(currentStore({ role: 'OWNER', permissions: {} }));
    const { access } = setup({ api: { getStore: owner }, storage: memoryStorage('store-1') });

    await access.loadStore();

    expect(access.isOwner).toBe(true);
    expect(access.can('can_view_finance')).toBe(true);
  });

  it('denies everything while no store is loaded', () => {
    expect(setup().access.can('can_manage_auctions')).toBe(false);
  });

  it('remembers the chosen store and drops the previous store data', async () => {
    const { access, storage } = setup({ storage: memoryStorage('store-1') });
    await access.loadStore();

    access.selectStore('store-2');

    expect(access.storeId).toBe('store-2');
    expect(access.store).toBeNull();
    expect(storage.get()).toBe('store-2');
  });

  it('keeps the loaded data when the same store is chosen again', async () => {
    const { access } = setup({ storage: memoryStorage('store-1') });
    await access.loadStore();

    access.selectStore('store-1');

    expect(access.store).not.toBeNull();
  });

  it('forgets the store', async () => {
    const { access, storage } = setup({ storage: memoryStorage('store-1') });
    await access.loadStore();

    access.clearStore();

    expect(access.storeId).toBeNull();
    expect(access.store).toBeNull();
    expect(storage.get()).toBeNull();
  });

  it('forgets the profile and the store on reset', async () => {
    const { access } = setup({ storage: memoryStorage('store-1') });
    await access.loadMe();
    await access.loadStore();

    access.reset();

    expect(access.me).toBeNull();
    expect(access.storeId).toBeNull();
    expect(access.role).toBeNull();
  });
});
