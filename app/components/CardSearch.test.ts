import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CardItem } from '../api/inventory';
import CardSearch from './CardSearch.vue';

const labels = {
  label: 'Available card in stock',
  hint: 'Search by #ID or name.',
  loading: 'Searching',
  none: 'No card found.',
  error: 'We could not search.',
  retry: 'Try again',
  count: '2 cards found',
};

function card(id: string, code: string, name: string, condition: string): CardItem {
  return {
    id,
    short_code: code,
    catalog: {
      id: `cat-${id}`,
      name,
      names: {},
      number: '044/185',
      set_id: null,
      set_name: 'Vivid Voltage',
      image_url: null,
      image_high_url: null,
      rarity: null,
    },
    language: 'EN',
    condition,
    is_foil: false,
    photos: [],
    notes: null,
    origin: 'OWN',
    consignor: null,
    commission_pct: null,
    status: 'AVAILABLE',
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
  } as CardItem;
}

const RESULTS = [card('c1', 'A1', 'Pikachu VMAX', 'NM'), card('c2', 'A2', 'Gengar VMAX', 'SP')];

function setup() {
  const selected: CardItem[] = [];
  const retries: number[] = [];
  render(CardSearch, {
    props: {
      query: 'vmax',
      results: RESULTS,
      labels,
      'onUpdate:query': () => undefined,
      onSelect: (item: CardItem) => selected.push(item),
      onRetry: () => retries.push(1),
    },
  });
  return { selected, retries, field: () => screen.getByRole('combobox', { name: labels.label }) };
}

describe('CardSearch', () => {
  it('shows each card with its #ID, name and condition', async () => {
    const { field } = setup();
    await userEvent.click(field());

    const first = screen.getAllByRole('option')[0]!;
    expect(first.textContent).toContain('#A1');
    expect(first.textContent).toContain('Pikachu VMAX 044/185');
    expect(first.textContent).toContain('NM');
  });

  it('says which card was picked', async () => {
    const { field, selected } = setup();
    await userEvent.click(field());

    await userEvent.click(screen.getAllByRole('option')[1]!);

    expect(selected.map((item) => item.id)).toEqual(['c2']);
  });
});
