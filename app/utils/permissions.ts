export const PERMISSIONS = [
  'can_delete',
  'can_view_finance',
  'can_manage_auctions',
  'can_manage_inventory',
  'can_manage_customers',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type PermissionMap = Record<Permission, boolean>;
export type StoreRole = 'OWNER' | 'STAFF';

/** Keeps the known permissions only; anything the API did not send counts as denied. */
export function toPermissionMap(raw: Record<string, boolean> | undefined): PermissionMap {
  const map = {} as PermissionMap;
  for (const permission of PERMISSIONS) map[permission] = raw?.[permission] === true;
  return map;
}
