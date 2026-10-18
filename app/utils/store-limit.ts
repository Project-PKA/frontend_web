interface StoreLike {
  role: 'OWNER' | 'STAFF';
}

interface MeLike {
  can_create_stores: boolean;
  store_limit: number;
}

/** The stores the person owns: the limit counts those, not the ones they only work in. */
export function ownedStores(stores: readonly StoreLike[]): number {
  return stores.filter((store) => store.role === 'OWNER').length;
}

/**
 * Whether to offer "create a new store". Needs the global permission and room under the
 * limit. The API checks both again (`CANNOT_CREATE_STORES`, `STORE_LIMIT_REACHED`).
 */
export function canCreateStore(me: MeLike, stores: readonly StoreLike[]): boolean {
  return me.can_create_stores && ownedStores(stores) < me.store_limit;
}
