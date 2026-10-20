import { z } from 'zod';
import {
  CUSTOMER_KINDS,
  type CustomerAddress,
  type CustomerChanges,
  type CustomerDetail,
  type CustomerFilters,
} from '../api/customers';
import { isCompleteCep, isCompleteCpf, maskCep } from './documents';
import { phoneDigits } from './phone';

function first(value: unknown): string | undefined {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' && one.trim() !== '' ? one.trim() : undefined;
}

/** What the list offers in its "type" filter: the two kinds of the API and the consignors. */
export const TYPE_FILTERS = ['VISITOR', 'CUSTOMER', 'CONSIGNOR'] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];

/** The filters of the address (`?type=CONSIGNOR&q=ana`), keeping only values the API knows. */
export function parseCustomerFilters(query: Record<string, unknown>): {
  q?: string;
  type?: TypeFilter;
} {
  const filters: { q?: string; type?: TypeFilter } = {};
  const q = first(query.q);
  const type = first(query.type);
  if (q) filters.q = q.slice(0, 80);
  if (type && (TYPE_FILTERS as readonly string[]).includes(type)) filters.type = type as TypeFilter;
  return filters;
}

/** The filters as the API takes them: a consignor is its own flag, not a kind. */
export function toApiFilters(filters: { q?: string; type?: TypeFilter }): CustomerFilters {
  const api: CustomerFilters = {};
  if (filters.q) api.q = filters.q;
  if (filters.type === 'CONSIGNOR') api.consignor = true;
  else if (filters.type && (CUSTOMER_KINDS as readonly string[]).includes(filters.type)) {
    api.kind = filters.type as (typeof CUSTOMER_KINDS)[number];
  }
  return api;
}

export function filtersToAddress(filters: {
  q?: string;
  type?: TypeFilter;
}): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.type) query.type = filters.type;
  return query;
}

/** A visitor has not completed the registration: no CPF and no address to confirm a sale. */
export const isIncomplete = (customer: { kind: string }): boolean => customer.kind === 'VISITOR';

const ADDRESS_FIELDS = ['zip', 'street', 'number', 'comp', 'city', 'state'] as const;
type AddressField = (typeof ADDRESS_FIELDS)[number];

/** The fields of the customer's form. Messages are translation keys. */
export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120, 'validation.tooLong'),
  email: z.union([
    z.literal(''),
    z.string().trim().max(254, 'validation.tooLong').pipe(z.email('validation.email')),
  ]),
  /** Written when typed, never read back: the API only gives a masked CPF. */
  cpf: z.string().refine((value) => value === '' || isCompleteCpf(value), 'validation.cpf'),
  zip: z.string().refine((value) => value === '' || isCompleteCep(value), 'validation.cep'),
  street: z.string().max(120, 'validation.tooLong'),
  number: z.string().max(20, 'validation.tooLong'),
  comp: z.string().max(60, 'validation.tooLong'),
  city: z.string().max(80, 'validation.tooLong'),
  state: z
    .string()
    .refine((value) => value === '' || /^[A-Za-z]{2}$/.test(value), 'validation.state'),
});
export type CustomerForm = z.output<typeof customerFormSchema>;

/** The form of a customer that exists: the CPF starts empty (the API never gives it back). */
export function formOf(customer: CustomerDetail): CustomerForm {
  const address: CustomerAddress = customer.address ?? {};
  return {
    name: customer.name,
    email: customer.email ?? '',
    cpf: '',
    zip: address.zip ? maskCep(address.zip) : '',
    street: address.street ?? '',
    number: address.number ?? '',
    comp: address.comp ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
  };
}

const blank = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/**
 * What changed, for `PATCH /v1/customers/{id}`: the API changes only what it receives. The CPF goes
 * only when one was typed; the address goes whole (every field, empty ones as `null`) as soon as
 * one field of it changed. Empty when nothing changed.
 */
export function toChanges(customer: CustomerDetail, form: CustomerForm): CustomerChanges {
  const changes: CustomerChanges = {};
  if (form.name.trim() !== customer.name) changes.name = form.name.trim();
  if ((blank(form.email) ?? null) !== (customer.email ?? null)) changes.email = blank(form.email);
  if (form.cpf !== '') changes.cpf = phoneDigits(form.cpf);

  const before = formOf(customer);
  const changed = ADDRESS_FIELDS.some((field) => form[field].trim() !== before[field].trim());
  if (changed) {
    const address: Record<AddressField, string | null> = {
      zip: null,
      street: null,
      number: null,
      comp: null,
      city: null,
      state: null,
    };
    for (const field of ADDRESS_FIELDS) {
      address[field] = blank(field === 'zip' ? phoneDigits(form.zip) : form[field]);
    }
    if (address.state) address.state = address.state.toUpperCase();
    changes.address = address;
  }
  return changes;
}
