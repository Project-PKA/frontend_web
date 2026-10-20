import { describe, expect, it } from 'vitest';
import type { CustomerDetail } from '../api/customers';
import {
  customerFormSchema,
  filtersToAddress,
  formOf,
  isIncomplete,
  parseCustomerFilters,
  toApiFilters,
  toChanges,
} from './customers';

const CUSTOMER = {
  id: 'u1',
  phone: '5511988771020',
  name: 'Ana Souza',
  email: 'ana@example.com',
  cpf_masked: '***.456.789-**',
  kind: 'CUSTOMER',
  is_blacklisted: false,
  blacklist_reason: null,
  last_interaction_at: null,
  address: {
    zip: '01310100',
    street: 'Rua A',
    number: '10',
    comp: null,
    city: 'São Paulo',
    state: 'SP',
  },
  created_at: '2026-10-01T12:00:00Z',
} as CustomerDetail;

describe('filters of the list', () => {
  it('reads the address, keeping only what is known', () => {
    expect(parseCustomerFilters({ q: ' ana ', type: 'CONSIGNOR' })).toEqual({
      q: 'ana',
      type: 'CONSIGNOR',
    });
    expect(parseCustomerFilters({ q: '  ', type: 'ALIEN' })).toEqual({});
    expect(parseCustomerFilters({ type: ['VISITOR', 'CUSTOMER'] }).type).toBe('VISITOR');
  });

  it('turns the type into what the API takes: a kind, or the consignor flag', () => {
    expect(toApiFilters({ q: 'ana', type: 'CUSTOMER' })).toEqual({ q: 'ana', kind: 'CUSTOMER' });
    expect(toApiFilters({ type: 'CONSIGNOR' })).toEqual({ consignor: true });
    expect(toApiFilters({})).toEqual({});
  });

  it('writes only what is set in the address', () => {
    expect(filtersToAddress({ type: 'VISITOR' })).toEqual({ type: 'VISITOR' });
    expect(filtersToAddress({})).toEqual({});
  });

  it('calls a visitor an incomplete registration', () => {
    expect(isIncomplete({ kind: 'VISITOR' })).toBe(true);
    expect(isIncomplete({ kind: 'CUSTOMER' })).toBe(false);
  });
});

describe('customerFormSchema', () => {
  const base = formOf(CUSTOMER);
  const issues = (overrides: Partial<typeof base>) => {
    const result = customerFormSchema.safeParse({ ...base, ...overrides });
    return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
  };

  it('accepts a customer as the API gave it', () => {
    expect(issues({})).toEqual([]);
  });

  it('wants a name, a valid e-mail when there is one, a whole CPF and CEP, and a two-letter state', () => {
    expect(issues({ name: '  ' })).toEqual(['name:validation.required']);
    expect(issues({ email: 'not-an-email' })).toEqual(['email:validation.email']);
    expect(issues({ email: '' })).toEqual([]);
    expect(issues({ cpf: '123.456' })).toEqual(['cpf:validation.cpf']);
    expect(issues({ cpf: '123.456.789-01' })).toEqual([]);
    expect(issues({ zip: '01310' })).toEqual(['zip:validation.cep']);
    expect(issues({ state: 'SPO' })).toEqual(['state:validation.state']);
    expect(issues({ state: 'sp' })).toEqual([]);
  });
});

describe('formOf and toChanges', () => {
  it('starts without the CPF, which the API never gives back, and with the CEP written', () => {
    expect(formOf(CUSTOMER)).toMatchObject({ cpf: '', zip: '01310-100', comp: '', state: 'SP' });
  });

  it('is empty when nothing changed', () => {
    expect(toChanges(CUSTOMER, formOf(CUSTOMER))).toEqual({});
  });

  it('sends only the fields that changed', () => {
    const form = { ...formOf(CUSTOMER), name: 'Ana S. Souza', email: '' };
    expect(toChanges(CUSTOMER, form)).toEqual({ name: 'Ana S. Souza', email: null });
  });

  it('sends the CPF only when one was typed, as digits', () => {
    expect(toChanges(CUSTOMER, { ...formOf(CUSTOMER), cpf: '123.456.789-01' })).toEqual({
      cpf: '12345678901',
    });
  });

  it('sends the whole address when one field of it changed, with the empty ones as null', () => {
    const form = { ...formOf(CUSTOMER), number: '20', comp: '  ', state: 'rj' };
    expect(toChanges(CUSTOMER, form)).toEqual({
      address: {
        zip: '01310100',
        street: 'Rua A',
        number: '20',
        comp: null,
        city: 'São Paulo',
        state: 'RJ',
      },
    });
  });
});
