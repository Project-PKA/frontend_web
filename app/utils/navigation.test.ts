import { describe, expect, it } from 'vitest';
import { decideAccess, type AccessContext } from './access';
import { ADMIN_NAV_ITEMS, NAV_ITEMS, isCurrent, visibleNavItems } from './navigation';
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
      'settlements',
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
    expect(ids({ ...base, permissions })).toEqual([
      'home',
      'inventory',
      'auctions',
      'customers',
      'settlements',
    ]);
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

  it('shows the way into the admin area only to a platform administrator', () => {
    expect(ids({ ...base, role: 'OWNER' })).not.toContain('admin');
    expect(ids({ ...base, role: 'OWNER', isPlatformAdmin: true }).at(-1)).toBe('admin');
    // The administrator does not need a store for it.
    expect(
      ids({ ...base, storeId: null, role: null, permissions: null, isPlatformAdmin: true }),
    ).toEqual(['admin']);
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

describe('the admin menu', () => {
  const dashboard = ADMIN_NAV_ITEMS.find((item) => item.id === 'dashboard')!;

  it('is for the platform administrator, with no store', () => {
    const context = { ...base, storeId: null, role: null, permissions: null };
    const ask = (isPlatformAdmin: boolean) =>
      ADMIN_NAV_ITEMS.filter(
        (item) => decideAccess(item.access, { ...context, isPlatformAdmin }).kind === 'allow',
      ).map((item) => item.id);
    expect(ask(true)).toContain('dashboard');
    expect(ask(false)).toEqual([]);
  });

  it('marks the dashboard current only on /admin, not on the pages under it', () => {
    expect(isCurrent(dashboard, '/admin')).toBe(true);
    expect(isCurrent(dashboard, '/admin/users')).toBe(false);
  });
});
