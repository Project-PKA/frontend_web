import type { Permission, PermissionMap, StoreRole } from './permissions';

/**
 * What a page needs. Set it with `definePageMeta({ access: { ... } })`.
 * A page without `access` is public. The server decides in the end: this only
 * avoids sending people to screens that would answer 403.
 */
export interface AccessRule {
  /** `session`: logged in. `store`: also a current store. `admin`: platform administrator. */
  level: 'session' | 'store' | 'admin';
  /** Store owner only (`level: 'store'`). */
  owner?: boolean;
  /** A store permission the page needs (`level: 'store'`). */
  permission?: Permission;
}

export interface AccessContext {
  authenticated: boolean;
  isPlatformAdmin: boolean;
  storeId: string | null;
  role: StoreRole | null;
  permissions: PermissionMap | null;
}

export type AccessDecision =
  | { kind: 'allow' }
  | { kind: 'login' }
  | { kind: 'select-store' }
  | { kind: 'forbidden'; reason: 'admin' | 'owner' | 'permission'; permission?: Permission };

export function decideAccess(rule: AccessRule, context: AccessContext): AccessDecision {
  if (!context.authenticated) return { kind: 'login' };
  if (rule.level === 'session') return { kind: 'allow' };

  if (rule.level === 'admin') {
    return context.isPlatformAdmin ? { kind: 'allow' } : { kind: 'forbidden', reason: 'admin' };
  }

  if (context.storeId === null || context.role === null) return { kind: 'select-store' };
  if (context.role === 'OWNER') return { kind: 'allow' };

  if (rule.owner) return { kind: 'forbidden', reason: 'owner' };
  if (rule.permission && context.permissions?.[rule.permission] !== true) {
    return { kind: 'forbidden', reason: 'permission', permission: rule.permission };
  }
  return { kind: 'allow' };
}

/**
 * Accepts only a path inside this app, so a crafted `?redirect=` cannot send
 * the person to another site.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || [...value].some((char) => char.charCodeAt(0) < 32)) return null;
  return value;
}
