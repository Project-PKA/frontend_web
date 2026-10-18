import { render, screen, within } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import AppTable from './AppTable.vue';

interface Card {
  id: string;
  name: string;
  price: string;
}

const columns = [
  { key: 'name', label: 'Card' },
  { key: 'price', label: 'Price', numeric: true },
];
const rows: Card[] = [
  { id: '1', name: 'Charizard ex', price: '25.50' },
  { id: '2', name: 'Pikachu', price: '3.00' },
];

function setup(slots: Record<string, string> = {}) {
  return render(AppTable<Card>, {
    props: { caption: 'Cards in stock', columns, rows, rowKey: (row: Card) => row.id },
    slots,
  });
}

describe('AppTable', () => {
  it('is a table named by its caption', () => {
    setup();
    expect(screen.getByRole('table', { name: 'Cards in stock' })).toBeTruthy();
  });

  it('has a column header for each column', () => {
    setup();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent?.trim())).toEqual(['Card', 'Price']);
    expect(headers.every((header) => header.getAttribute('scope') === 'col')).toBe(true);
  });

  it('shows one row per item with the value of each column', () => {
    setup();
    const body = screen.getAllByRole('row').slice(1);
    expect(body).toHaveLength(2);
    expect(
      within(body[0]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent?.trim()),
    ).toEqual(['Charizard ex', '25.50']);
  });

  it('labels each cell with its column, which the small-screen layout shows', () => {
    setup();
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual(['Card', 'Price']);
  });

  it('aligns numeric columns like the design', () => {
    setup();
    expect(screen.getByRole('columnheader', { name: 'Price' }).className).toContain('num');
    expect(within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[1]!.className).toContain(
      'num',
    );
    expect(within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[0]!.className).not.toContain(
      'num',
    );
  });

  it('lets a page draw a cell its own way', () => {
    setup({
      'cell-name':
        '<template #cell-name="{ row }"><a :href="`/cards/${row.id}`">{{ row.name }}</a></template>',
    });
    expect(screen.getByRole('link', { name: 'Charizard ex' }).getAttribute('href')).toBe(
      '/cards/1',
    );
    expect(screen.getByRole('link', { name: 'Pikachu' }).getAttribute('href')).toBe('/cards/2');
  });

  it('shows no body rows for an empty list', () => {
    render(AppTable<Card>, {
      props: { caption: 'Cards', columns, rows: [], rowKey: (row: Card) => row.id },
    });
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});
