import { describe, expect, it } from 'vitest';
import { decideAccess, safeRedirectPath, type AccessContext } from './access';
import { toPermissionMap } from './permissions';

const anonymous: AccessContext = {
  authenticated: false,
  isPlatformAdmin: false,
  storeId: null,
  role: null,
  permissions: null,
};

const staff: AccessContext = {
  authenticated: true,
  isPlatformAdmin: false,
  storeId: 'store-1',
  role: 'STAFF',
  permissions: toPermissionMap({ can_manage_auctions: true }),
};

const owner: AccessContext = { ...staff, role: 'OWNER', permissions: toPermissionMap({}) };

describe('decideAccess', () => {
  it.each(['session', 'store', 'admin'] as const)(
    'sends anonymous people to the login (%s)',
    (level) => {
      expect(decideAccess({ level }, anonymous)).toEqual({ kind: 'login' });
    },
  );

  it('lets any logged in person into a session page', () => {
    expect(decideAccess({ level: 'session' }, { ...staff, storeId: null, role: null })).toEqual({
      kind: 'allow',
    });
  });

  it('keeps everyone but platform administrators out of the admin area', () => {
    expect(decideAccess({ level: 'admin' }, staff)).toEqual({ kind: 'forbidden', reason: 'admin' });
    expect(decideAccess({ level: 'admin' }, { ...staff, isPlatformAdmin: true })).toEqual({
      kind: 'allow',
    });
  });

  it('asks for a store before showing a store page', () => {
    expect(decideAccess({ level: 'store' }, { ...staff, storeId: null, role: null })).toEqual({
      kind: 'select-store',
    });
  });

  it('allows a store page that needs no permission', () => {
    expect(decideAccess({ level: 'store' }, staff)).toEqual({ kind: 'allow' });
  });

  it('allows staff that has the permission', () => {
    const rule = { level: 'store', permission: 'can_manage_auctions' } as const;
    expect(decideAccess(rule, staff)).toEqual({ kind: 'allow' });
  });

  it('blocks staff that lacks the permission and says which one', () => {
    const rule = { level: 'store', permission: 'can_view_finance' } as const;
    expect(decideAccess(rule, staff)).toEqual({
      kind: 'forbidden',
      reason: 'permission',
      permission: 'can_view_finance',
    });
  });

  it('blocks staff from owner-only pages', () => {
    expect(decideAccess({ level: 'store', owner: true }, staff)).toEqual({
      kind: 'forbidden',
      reason: 'owner',
    });
  });

  it('lets the owner into everything in the store, whatever the permission map says', () => {
    const rule = { level: 'store', owner: true, permission: 'can_view_finance' } as const;
    expect(decideAccess(rule, owner)).toEqual({ kind: 'allow' });
  });

  it('does not treat a platform administrator as a store owner', () => {
    const admin = { ...staff, isPlatformAdmin: true };
    expect(decideAccess({ level: 'store', owner: true }, admin)).toEqual({
      kind: 'forbidden',
      reason: 'owner',
    });
  });
});

describe('safeRedirectPath', () => {
  it('accepts a path inside the app, with query and fragment', () => {
    expect(safeRedirectPath('/inventory?status=open#top')).toBe('/inventory?status=open#top');
  });

  it.each([
    ['another site', 'https://evil.example.com'],
    ['a protocol-relative URL', '//evil.example.com'],
    ['a backslash trick', '/\\evil.example.com'],
    ['a control character', '/a\nb'],
    ['a relative path', 'inventory'],
    ['a number', 42],
    ['nothing', undefined],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });
});
