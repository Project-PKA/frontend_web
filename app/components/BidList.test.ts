import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import BidList from './BidList.vue';

const ROWS = [
  { id: 'b3', time: '21:42:10', phone: '(11) *****-1020', amount: 'R$ 820,00' },
  { id: 'b2', time: '21:41:55', phone: '(21) *****-4455', amount: 'R$ 800,00' },
];

describe('BidList', () => {
  it('lists the bids as they come, the highest first, each with its time, phone and amount', () => {
    render(BidList, { props: { rows: ROWS, label: 'Bids received', empty: 'No bids yet.' } });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('21:42:10');
    expect(items[0]!.textContent).toContain('(11) *****-1020');
    expect(items[0]!.textContent).toContain('R$ 820,00');
    expect(screen.getByRole('list', { name: 'Bids received' })).toBeTruthy();
  });

  it('says so when there is no bid yet, instead of an empty list', () => {
    render(BidList, { props: { rows: [], label: 'Bids received', empty: 'No bids yet.' } });

    expect(screen.getByText('No bids yet.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
