import { describe, expect, it } from 'vitest';
import { canCreateStore, ownedStores } from './store-limit';

const owner = { role: 'OWNER' } as const;
const staff = { role: 'STAFF' } as const;

describe('ownedStores', () => {
  it('counts only the stores the person owns', () => {
    expect(ownedStores([owner, staff, owner, staff])).toBe(2);
    expect(ownedStores([])).toBe(0);
  });
});

describe('canCreateStore', () => {
  it('is offered with the permission and room under the limit', () => {
    expect(canCreateStore({ can_create_stores: true, store_limit: 2 }, [owner])).toBe(true);
    expect(canCreateStore({ can_create_stores: true, store_limit: 1 }, [])).toBe(true);
  });

  it('is not offered without the global permission', () => {
    expect(canCreateStore({ can_create_stores: false, store_limit: 5 }, [])).toBe(false);
  });

  it('is not offered at the limit', () => {
    expect(canCreateStore({ can_create_stores: true, store_limit: 1 }, [owner])).toBe(false);
  });

  it('does not count the stores where the person only works', () => {
    expect(canCreateStore({ can_create_stores: true, store_limit: 1 }, [staff, staff])).toBe(true);
  });

  it('is not offered with a limit of zero', () => {
    expect(canCreateStore({ can_create_stores: true, store_limit: 0 }, [])).toBe(false);
  });
});
