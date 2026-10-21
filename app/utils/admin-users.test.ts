import { describe, expect, it } from 'vitest';
import {
  newUserSchema,
  parseStoreLimit,
  parseUserFilters,
  toApiUserFilters,
  toPermissionChanges,
  userFiltersToAddress,
} from './admin-users';

describe('parseUserFilters', () => {
  it('keeps the values the API knows', () => {
    expect(parseUserFilters({ q: ' ana ', status: 'SUSPENDED', create: 'yes' })).toEqual({
      q: 'ana',
      status: 'SUSPENDED',
      create: 'yes',
    });
  });

  it('drops anything else', () => {
    expect(parseUserFilters({ status: 'GONE', create: 'maybe', q: ' ' })).toEqual({});
    expect(parseUserFilters({ q: ['a', 'b'] })).toEqual({ q: 'a' });
  });
});

describe('the filters for the API and for the address', () => {
  it('turns "create" into the boolean of the API', () => {
    expect(toApiUserFilters({ create: 'yes' })).toEqual({ can_create_stores: true });
    expect(toApiUserFilters({ create: 'no', status: 'ACTIVE', q: 'x' })).toEqual({
      can_create_stores: false,
      status: 'ACTIVE',
      q: 'x',
    });
    expect(toApiUserFilters({})).toEqual({});
  });

  it('puts only what is set in the address', () => {
    expect(userFiltersToAddress({ q: 'ana', create: 'no' })).toEqual({ q: 'ana', create: 'no' });
    expect(userFiltersToAddress({})).toEqual({});
  });
});

describe('newUserSchema', () => {
  it('accepts an e-mail, with the name optional', () => {
    expect(newUserSchema.safeParse({ email: ' ana@example.com ', name: '' }).data).toEqual({
      email: 'ana@example.com',
      name: '',
    });
  });

  it('asks for the e-mail and refuses a malformed one, with translation keys', () => {
    expect(newUserSchema.safeParse({ email: ' ', name: '' }).error?.issues[0]?.message).toBe(
      'admin.users.errors.emailRequired',
    );
    expect(newUserSchema.safeParse({ email: 'ana@', name: '' }).error?.issues[0]?.message).toBe(
      'admin.users.errors.emailInvalid',
    );
  });

  it('refuses a name that is too long', () => {
    expect(
      newUserSchema.safeParse({ email: 'a@example.com', name: 'x'.repeat(121) }).error?.issues[0]
        ?.message,
    ).toBe('validation.tooLong');
  });
});

describe('parseStoreLimit', () => {
  it('reads a number or a text, with empty as zero', () => {
    expect(parseStoreLimit(3)).toBe(3);
    expect(parseStoreLimit(' 12 ')).toBe(12);
    expect(parseStoreLimit('')).toBe(0);
    expect(parseStoreLimit(undefined)).toBe(0);
  });

  it('refuses what is not a whole number from 0 to 100', () => {
    expect(parseStoreLimit('-1')).toBeNull();
    expect(parseStoreLimit('2.5')).toBeNull();
    expect(parseStoreLimit('abc')).toBeNull();
    expect(parseStoreLimit(101)).toBeNull();
    expect(parseStoreLimit(100)).toBe(100);
  });
});

describe('toPermissionChanges', () => {
  const user = { can_create_stores: false, store_limit: 0 };

  it('sends only what changed', () => {
    expect(toPermissionChanges(user, { canCreate: true, storeLimit: 0 })).toEqual({
      can_create_stores: true,
    });
    expect(toPermissionChanges(user, { canCreate: false, storeLimit: 3 })).toEqual({
      store_limit: 3,
    });
    expect(toPermissionChanges(user, { canCreate: true, storeLimit: 3 })).toEqual({
      can_create_stores: true,
      store_limit: 3,
    });
  });

  it('is null when nothing changed', () => {
    expect(toPermissionChanges(user, { canCreate: false, storeLimit: 0 })).toBeNull();
  });
});
