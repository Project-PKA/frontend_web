import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Customer } from '../api/customers';
import CustomerSearch from './CustomerSearch.vue';

const labels = {
  label: 'Consignor customer',
  hint: 'Search by name, phone or CPF.',
  loading: 'Searching',
  none: 'No customer found.',
  error: 'We could not search.',
  retry: 'Try again',
  count: '2 customers found',
};

function customer(id: string, name: string, cpf: string | null, phone: string): Customer {
  return {
    id,
    phone,
    name,
    email: null,
    cpf_masked: cpf,
    kind: 'CUSTOMER',
    is_blacklisted: false,
    blacklist_reason: null,
    last_interaction_at: null,
    address: null,
    created_at: '2026-10-01T12:00:00Z',
  } as unknown as Customer;
}

const RESULTS = [
  customer('u1', 'Ana Souza', '***.456.789-**', '5511988771020'),
  customer('u2', 'Ana Lima', null, '5521977665544'),
];

function setup() {
  const selected: Customer[] = [];
  render(CustomerSearch, {
    props: {
      query: 'ana',
      results: RESULTS,
      labels,
      'onUpdate:query': () => undefined,
      onSelect: (item: Customer) => selected.push(item),
    },
  });
  return { selected, field: () => screen.getByRole('combobox', { name: labels.label }) };
}

describe('CustomerSearch', () => {
  it('tells two people with the same name apart without showing a whole phone number', async () => {
    const { field } = setup();
    await userEvent.click(field());

    const [first, second] = screen.getAllByRole('option');
    expect(first!.textContent).toContain('Ana Souza');
    expect(first!.textContent).toContain('***.456.789-**');
    expect(second!.textContent).toContain('Ana Lima');
    expect(second!.textContent).toContain('…5544');
    expect(second!.textContent).not.toContain('5521977665544');
  });

  it('says which customer was picked', async () => {
    const { field, selected } = setup();
    await userEvent.click(field());

    await userEvent.click(screen.getAllByRole('option')[0]!);

    expect(selected.map((item) => item.id)).toEqual(['u1']);
  });
});
