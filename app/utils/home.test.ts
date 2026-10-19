import { describe, expect, it } from 'vitest';
import { cardRows, pollLabels, settlementRows, setupComplete, setupDone, setupSteps } from './home';

const NEW_STORE = {
  store_created: true,
  whatsapp_connected: false,
  first_card: false,
  first_auction: false,
};

describe('setupSteps', () => {
  it('lists the four steps in order, with only the store done in a new store', () => {
    expect(setupSteps(NEW_STORE).map((step) => [step.id, step.done])).toEqual([
      ['store', true],
      ['whatsapp', false],
      ['card', false],
      ['auction', false],
    ]);
  });

  it('cannot schedule an auction before there is a card', () => {
    expect(setupSteps(NEW_STORE).find((step) => step.id === 'auction')?.blocked).toBe(true);
    expect(
      setupSteps({ ...NEW_STORE, first_card: true }).find((step) => step.id === 'auction')?.blocked,
    ).toBe(false);
  });

  it('counts what is done', () => {
    expect(setupDone(NEW_STORE)).toBe(1);
    expect(setupDone({ ...NEW_STORE, whatsapp_connected: true, first_card: true })).toBe(3);
  });

  it('is complete only when all four are done', () => {
    expect(setupComplete(NEW_STORE)).toBe(false);
    expect(
      setupComplete({
        store_created: true,
        whatsapp_connected: true,
        first_card: true,
        first_auction: true,
      }),
    ).toBe(true);
  });
});

describe('rows of the lists', () => {
  it('leaves out a row that has no id and fills a missing text with an empty one', () => {
    expect(
      cardRows([
        { id: 'c1', short_code: '0471', name: 'Pikachu VMAX' },
        { name: 'no id' },
        { id: 'c2' },
      ]),
    ).toEqual([
      { id: 'c1', shortCode: '0471', name: 'Pikachu VMAX' },
      { id: 'c2', shortCode: '', name: '' },
    ]);
  });

  it('keeps the amount as the string the API sent', () => {
    expect(
      settlementRows([
        {
          id: 's1',
          customer: { id: 'u1', name: 'Rafael M.' },
          total_amount: '340.00',
          items: 2,
          created_at: '2026-10-18T14:48:00Z',
        },
        { id: 's2' },
        { customer: { id: 'u3', name: 'no id' } },
      ]),
    ).toEqual([
      {
        id: 's1',
        customerId: 'u1',
        customerName: 'Rafael M.',
        items: 2,
        totalAmount: '340.00',
        createdAt: '2026-10-18T14:48:00Z',
      },
      {
        id: 's2',
        customerId: null,
        customerName: '',
        items: 0,
        totalAmount: null,
        createdAt: null,
      },
    ]);
  });

  it('labels the poll auctions with the card code and name', () => {
    expect(
      pollLabels([
        {
          auction_id: 'a1',
          card: { id: 'c1', short_code: '0412', name: 'Charizard ex' },
          ceiling: '300.00',
          current_bid: '250.00',
          provisional_winner: null,
        },
      ]),
    ).toEqual(['#0412 Charizard ex']);
  });
});
