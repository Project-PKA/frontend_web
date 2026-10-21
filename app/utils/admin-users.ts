import { z } from 'zod';
import type { AdminUser, UserFilters, UserPermissions, UserStatus } from '../api/admin';

export const USER_STATUSES = [
  'ACTIVE',
  'INVITED',
  'SUSPENDED',
] as const satisfies readonly UserStatus[];
/** The "can create stores" filter has three positions: any, yes, no. */
export const CREATE_FILTERS = ['yes', 'no'] as const;
export type CreateFilter = (typeof CREATE_FILTERS)[number];

export interface UserFilterState {
  q?: string;
  status?: UserStatus;
  create?: CreateFilter;
}

function first(value: unknown): string | undefined {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' && one.trim() !== '' ? one.trim() : undefined;
}

/** The filters of the address (`?status=SUSPENDED&create=yes`), keeping only values the API knows. */
export function parseUserFilters(query: Record<string, unknown>): UserFilterState {
  const filters: UserFilterState = {};
  const q = first(query.q);
  const status = first(query.status);
  const create = first(query.create);
  if (q) filters.q = q.slice(0, 80);
  if (status && (USER_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as UserStatus;
  }
  if (create && (CREATE_FILTERS as readonly string[]).includes(create)) {
    filters.create = create as CreateFilter;
  }
  return filters;
}

/** The filters as the API takes them. */
export function toApiUserFilters(filters: UserFilterState): UserFilters {
  const api: UserFilters = {};
  if (filters.q) api.q = filters.q;
  if (filters.status) api.status = filters.status;
  if (filters.create) api.can_create_stores = filters.create === 'yes';
  return api;
}

export function userFiltersToAddress(filters: UserFilterState): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.status) query.status = filters.status;
  if (filters.create) query.create = filters.create;
  return query;
}

/** The most stores of their own a person can be allowed to create. */
export const STORE_LIMIT_MAX = 100;

/** What a new account takes: the e-mail is required, the name is optional. Messages are keys. */
export const newUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'admin.users.errors.emailRequired')
    .max(254, 'admin.users.errors.emailInvalid')
    .pipe(z.email('admin.users.errors.emailInvalid')),
  name: z.string().trim().max(120, 'validation.tooLong'),
});

/**
 * The limit field gives a number or text (a number input does both), so it is read as text. An
 * empty field is zero; anything that is not a whole number from 0 to the maximum is `null`.
 */
export function parseStoreLimit(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (text === '') return 0;
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return number <= STORE_LIMIT_MAX ? number : null;
}

/** Only what changed, because the API changes only what it receives (`null` when nothing did). */
export function toPermissionChanges(
  user: Pick<AdminUser, 'can_create_stores' | 'store_limit'>,
  form: { canCreate: boolean; storeLimit: number },
): UserPermissions | null {
  const changes: UserPermissions = {};
  if (form.canCreate !== user.can_create_stores) changes.can_create_stores = form.canCreate;
  if (form.storeLimit !== user.store_limit) changes.store_limit = form.storeLimit;
  return Object.keys(changes).length > 0 ? changes : null;
}
