import { describe, expect, it } from 'vitest';
import type { AccessContext } from './access';
import { NAV_ITEMS, isCurrent, visibleNavItems } from './navigation';
import { toPermissionMap } from './permissions';

const base: AccessContext = {
  authenticated: true,
  isPlatformAdmin: false,
  storeId: 'store-1',
  role: 'STAFF',
  permissions: toPermissionMap({}),
};

const ids = (context: AccessContext) => visibleNavItems(context).map((item) => item.id);

describe('visibleNavItems', () => {
  it('shows the owner every item, in the order of the design', () => {
    expect(ids({ ...base, role: 'OWNER' })).toEqual([
      'home',
      'inventory',
      'auctions',
      'customers',
      'team',
      'settings',
      'finance',
    ]);
  });

  it('shows staff without permissions only the home', () => {
    expect(ids(base)).toEqual(['home']);
  });

  it('shows each staff member the items their permissions open', () => {
    const permissions = toPermissionMap({
      can_manage_inventory: true,
      can_manage_auctions: true,
      can_manage_customers: true,
    });
    expect(ids({ ...base, permissions })).toEqual(['home', 'inventory', 'auctions', 'customers']);
  });

  it('shows the finance only to staff that may see it', () => {
    const permissions = toPermissionMap({ can_view_finance: true });
    expect(ids({ ...base, permissions })).toEqual(['home', 'finance']);
  });

  it('never shows the owner-only items to staff', () => {
    const permissions = toPermissionMap({
      can_delete: true,
      can_view_finance: true,
      can_manage_auctions: true,
      can_manage_inventory: true,
      can_manage_customers: true,
    });
    const shown = ids({ ...base, permissions });
    expect(shown).not.toContain('team');
    expect(shown).not.toContain('settings');
  });

  it('shows nothing before a store is chosen', () => {
    expect(ids({ ...base, storeId: null, role: null, permissions: null })).toEqual([]);
  });

  it('shows nothing to someone who is not logged in', () => {
    expect(ids({ ...base, authenticated: false })).toEqual([]);
  });

  it('has an item for every entry once, with its own path', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((item) => item.to)).size).toBe(NAV_ITEMS.length);
    expect(
      NAV_ITEMS.every((item) => item.to.startsWith('/') && item.labelKey.startsWith('nav.')),
    ).toBe(true);
  });
});

describe('isCurrent', () => {
  const inventory = NAV_ITEMS.find((item) => item.id === 'inventory')!;

  it('is current on its own page and on the pages under it', () => {
    expect(isCurrent(inventory, '/inventory')).toBe(true);
    expect(isCurrent(inventory, '/inventory/new')).toBe(true);
    expect(isCurrent(inventory, '/inventory/42/edit')).toBe(true);
  });

  it('is not current on another page, even with a similar name', () => {
    expect(isCurrent(inventory, '/home')).toBe(false);
    expect(isCurrent(inventory, '/inventory-old')).toBe(false);
  });
});
