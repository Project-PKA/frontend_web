import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  MAX_RECEIPT_BYTES,
  accessKey,
  checkReceipt,
  commissionOf,
  normalizeConsignor,
  normalizeShowcase,
  normalizeSettlement,
  toBuyerSubmission,
  type BuyerForm,
} from './public-pages';

describe('normalizeSettlement', () => {
  it('reads the page the API sends', () => {
    const view = normalizeSettlement({
      store_name: 'Card Hub',
      pix_key: 'loja-pix',
      status: 'PENDING',
      payment_claimed_at: null,
      receipt_sent: false,
      total_amount: '115.00',
      expires_at: '2030-03-10T12:00:00Z',
      items: [
        {
          short_code: '0366',
          name: 'Gardevoir ex',
          condition: 'NM',
          language: 'PT',
          amount: '95.00',
        },
        {
          short_code: '0359',
          name: 'Ralts Promo',
          condition: 'SP',
          language: 'EN',
          amount: '20.00',
        },
      ],
      buyer: { first_name: 'Bruno', cpf_masked: null, city: null, state: null, has_address: false },
    });
    expect(view).toMatchObject({
      storeName: 'Card Hub',
      pixKey: 'loja-pix',
      status: 'PENDING',
      claimedAt: null,
      receiptSent: false,
      total: '115.00',
    });
    expect(view.items).toHaveLength(2);
    expect(view.items[0]).toEqual({
      code: '0366',
      name: 'Gardevoir ex',
      condition: 'NM',
      language: 'PT',
      amount: '95.00',
    });
    expect(view.buyer).toEqual({
      firstName: 'Bruno',
      cpfMasked: null,
      city: null,
      state: null,
      hasAddress: false,
    });
  });

  it('survives a page with fields missing', () => {
    const view = normalizeSettlement({});
    expect(view).toMatchObject({ status: 'PENDING', total: '0.00', pixKey: null, items: [] });
    expect(normalizeSettlement(null).items).toEqual([]);
    expect(normalizeSettlement({ status: 'PAID' }).status).toBe('PAID');
  });
});

const form: BuyerForm = {
  cpf: '529.982.247-25',
  zip: '01310-100',
  street: ' Rua A ',
  number: ' 10 ',
  comp: '  ',
  city: ' São Paulo ',
  state: 'sp',
  consent: true,
};

describe('toBuyerSubmission', () => {
  it('builds the body with digits, the state in capitals and the version of the term', () => {
    expect(toBuyerSubmission(form)).toEqual({
      data: {
        cpf: '52998224725',
        address: {
          zip: '01310100',
          street: 'Rua A',
          number: '10',
          comp: null,
          city: 'São Paulo',
          state: 'SP',
        },
        consent: { accepted: true, version: CONSENT_VERSION },
      },
    });
  });

  it('sends the complement when there is one', () => {
    const result = toBuyerSubmission({ ...form, comp: ' Apto 2 ' });
    expect('data' in result && result.data.address.comp).toBe('Apto 2');
  });

  it('names what is wrong, as keys', () => {
    expect(
      toBuyerSubmission({
        cpf: '123',
        zip: '12',
        street: ' ',
        number: '',
        comp: 'x'.repeat(61),
        city: '',
        state: 'S',
        consent: false,
      }),
    ).toEqual({
      errors: {
        cpf: true,
        zip: true,
        street: true,
        number: true,
        comp: true,
        city: true,
        state: true,
        consent: true,
      },
    });
  });

  it('needs the consent, even with everything else right', () => {
    expect(toBuyerSubmission({ ...form, consent: false })).toEqual({ errors: { consent: true } });
  });
});

describe('normalizeConsignor', () => {
  const page = {
    store_name: 'Card Hub',
    first_name: 'Rafael',
    expires_at: '2030-03-10T12:00:00Z',
    estimate_is_final: false,
    cards: [
      {
        short_code: '0431',
        name: 'Pikachu VMAX',
        number: '044/185',
        condition: 'NM',
        language: 'PT',
        card_status: 'IN_AUCTION',
        commission_pct: '15.00',
        auction: {
          status: 'ACTIVE',
          ends_at: '2030-03-05T22:00:00Z',
          current_bid: '465.00',
          bid_count: 41,
          estimated_payout: '395.25',
          bids: [{ amount: '465.00', at: '2030-03-05T21:42:10Z', phone: '(11) 9••••-1020' }],
        },
      },
      {
        short_code: '0450',
        name: 'Mew ex',
        number: '151',
        condition: 'SP',
        language: 'EN',
        card_status: 'AVAILABLE',
        commission_pct: '15.00',
        auction: null,
      },
    ],
  };

  it('reads the cards, with the auction of the one that has it', () => {
    const view = normalizeConsignor(page);
    expect(view).toMatchObject({
      storeName: 'Card Hub',
      firstName: 'Rafael',
      estimateIsFinal: false,
    });
    expect(view.cards).toHaveLength(2);
    expect(view.cards[0]!.auction).toMatchObject({
      status: 'ACTIVE',
      currentBid: '465.00',
      bidCount: 41,
      estimatedPayout: '395.25',
    });
    expect(view.cards[0]!.auction!.bids[0]).toEqual({
      amount: '465.00',
      at: '2030-03-05T21:42:10Z',
      phone: '(11) 9••••-1020',
    });
    expect(view.cards[1]!.auction).toBeNull();
  });

  it('survives a page with fields missing', () => {
    expect(normalizeConsignor(undefined).cards).toEqual([]);
    const view = normalizeConsignor({ cards: [{ auction: { bids: 'nope' } }] });
    expect(view.cards[0]!.auction).toMatchObject({ currentBid: null, bidCount: 0, bids: [] });
  });
});

describe('normalizeShowcase', () => {
  const page = {
    items: [
      {
        store: {
          id: 's-1',
          name: 'Card Hub',
          city: 'São Paulo',
          group_url: 'https://chat.whatsapp.com/AbCdEfGhIj12',
        },
        card: {
          short_code: '0431',
          name: 'Pikachu VMAX',
          number: '044/185',
          set_name: 'Vivid Voltage',
          condition: 'NM',
          language: 'PT',
          is_foil: true,
          image_url: 'https://assets.example.com/low.webp',
        },
        current_bid: '465.00',
        bid_count: 41,
        last_bid_at: '2030-03-05T21:42:10Z',
        ends_at: '2030-03-05T22:00:00Z',
      },
    ],
    total: 6,
    stores: [{ id: 's-1', name: 'Card Hub' }, { name: 'no id' }],
  };

  it('reads the items, the total and the stores of the filter', () => {
    const view = normalizeShowcase(page);
    expect(view.total).toBe(6);
    expect(view.stores).toEqual([{ id: 's-1', name: 'Card Hub' }]);
    expect(view.items[0]).toMatchObject({
      storeName: 'Card Hub',
      city: 'São Paulo',
      groupUrl: 'https://chat.whatsapp.com/AbCdEfGhIj12',
      code: '0431',
      name: 'Pikachu VMAX',
      set: 'Vivid Voltage',
      foil: true,
      imageUrl: 'https://assets.example.com/low.webp',
      currentBid: '465.00',
      bidCount: 41,
    });
  });

  it('survives an auction with no bid, no image and fields missing', () => {
    const view = normalizeShowcase({ items: [{ card: { name: 'Mew ex' } }] });
    expect(view.items[0]).toMatchObject({
      name: 'Mew ex',
      currentBid: null,
      bidCount: 0,
      imageUrl: null,
      groupUrl: null,
    });
    expect(normalizeShowcase(undefined)).toEqual({ items: [], total: 0, stores: [] });
  });
});

describe('commissionOf', () => {
  it('is the bid minus what is passed on, never below zero', () => {
    expect(commissionOf('465.00', '395.25')).toBe('69.75');
    expect(commissionOf('10.00', '12.00')).toBe('0.00');
  });
});

describe('checkReceipt', () => {
  it('accepts an image up to 5 MB', () => {
    expect(checkReceipt({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkReceipt({ type: 'image/webp', size: MAX_RECEIPT_BYTES })).toBeNull();
  });

  it('refuses what is not a JPEG, PNG or WebP, an empty file and a big one', () => {
    expect(checkReceipt({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(checkReceipt({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(checkReceipt({ type: 'image/png', size: 0 })).toBe('empty');
    expect(checkReceipt({ type: 'image/png', size: MAX_RECEIPT_BYTES + 1 })).toBe('size');
  });
});

describe('accessKey', () => {
  it('is the 4 digits, or null while incomplete', () => {
    expect(accessKey('5299')).toBe('5299');
    expect(accessKey('52 9')).toBeNull();
    expect(accessKey('')).toBeNull();
  });
});
