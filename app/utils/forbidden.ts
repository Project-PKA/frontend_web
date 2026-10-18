import type { ApiError } from '../api/errors';

export type ForbiddenAction = 'no-permission' | 'reselect-store' | 'none';

/**
 * What to do with a 403 from the API. `MISSING_PERMISSION` and `OWNER_REQUIRED` mean the
 * person lacks a permission. A plain 403 (`FORBIDDEN`, or no code) means the store is not
 * one the person belongs to (anymore), so they pick a store again. Any other code is a
 * rule of one action (`CANNOT_CREATE_STORES`...): the screen that asked shows its message.
 */
export function forbiddenAction(error: ApiError): ForbiddenAction {
  if (error.code === 'MISSING_PERMISSION' || error.code === 'OWNER_REQUIRED') {
    return 'no-permission';
  }
  if (error.code === null || error.code === 'FORBIDDEN') return 'reselect-store';
  return 'none';
}
