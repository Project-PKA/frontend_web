import type { ApiError } from '../api/errors';

export type ForbiddenAction = 'no-permission' | 'reselect-store';

/**
 * What to do with a 403 from the API. `MISSING_PERMISSION` and `OWNER_REQUIRED`
 * mean the person lacks a permission. A 403 without those codes means the store
 * is not one the person belongs to (anymore), so they pick a store again.
 */
export function forbiddenAction(error: ApiError): ForbiddenAction {
  if (error.code === 'MISSING_PERMISSION' || error.code === 'OWNER_REQUIRED') {
    return 'no-permission';
  }
  return 'reselect-store';
}
