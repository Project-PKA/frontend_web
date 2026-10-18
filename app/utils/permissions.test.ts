import { describe, expect, it } from 'vitest';
import { PERMISSIONS, toPermissionMap } from './permissions';

describe('toPermissionMap', () => {
  it('keeps the granted permissions and denies the rest', () => {
    const map = toPermissionMap({ can_manage_auctions: true, can_delete: false });
    expect(map.can_manage_auctions).toBe(true);
    expect(map.can_delete).toBe(false);
    expect(map.can_view_finance).toBe(false);
  });

  it('covers every known permission', () => {
    expect(Object.keys(toPermissionMap(undefined)).sort()).toEqual([...PERMISSIONS].sort());
  });

  it('ignores unknown keys and values that are not true', () => {
    const map = toPermissionMap({ can_everything: true } as Record<string, boolean>);
    expect(map).not.toHaveProperty('can_everything');
    expect(
      toPermissionMap({ can_delete: 'yes' } as unknown as Record<string, boolean>).can_delete,
    ).toBe(false);
  });
});
