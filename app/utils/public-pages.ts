import type { BuyerAddress, BuyerSubmission } from '../api/public-pages';
import { isCompleteCep, isCompleteCpf } from './documents';
import { fromCents, toCents } from './finance';
import { phoneDigits } from './phone';

/**
 * The version of the data-consent term the buyer read. The text is still to be reviewed by a
 * lawyer (decision D2): when it changes, this changes with it, so the store can tell which one
 * each buyer accepted.
 */
export const CONSENT_VERSION = 'draft-2026-10-21';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const orNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];

// ---- The settlement of a buyer

export interface SettlementItem {
  code: string;
  name: string;
  condition: string;
  language: string;
  amount: string;
}

export interface SettlementView {
  storeName: string;
  pixKey: string | null;
  status: 'PENDING' | 'PAID';
  claimedAt: string | null;
  /** The buyer already sent the receipt. */
  receiptSent: boolean;
  total: string;
  expiresAt: string;
  items: SettlementItem[];
  buyer: {
    firstName: string;
    cpfMasked: string | null;
    city: string | null;
    state: string | null;
    hasAddress: boolean;
  };
}

/** The settlement as the screen uses it. The contract leaves the inner fields open, so each is read with care. */
export function normalizeSettlement(raw: unknown): SettlementView {
  const page = record(raw);
  const buyer = record(page.buyer);
  return {
    storeName: text(page.store_name),
    pixKey: orNull(page.pix_key),
    status: page.status === 'PAID' ? 'PAID' : 'PENDING',
    claimedAt: orNull(page.payment_claimed_at),
    receiptSent: page.receipt_sent === true,
    total: text(page.total_amount) || '0.00',
    expiresAt: text(page.expires_at),
    items: list(page.items).map((item) => ({
      code: text(item.short_code),
      name: text(item.name),
      condition: text(item.condition),
      language: text(item.language),
      amount: text(item.amount) || '0.00',
    })),
    buyer: {
      firstName: text(buyer.first_name),
      cpfMasked: orNull(buyer.cpf_masked),
      city: orNull(buyer.city),
      state: orNull(buyer.state),
      hasAddress: buyer.has_address === true,
    },
  };
}

export interface BuyerForm {
  cpf: string;
  zip: string;
  street: string;
  number: string;
  comp: string;
  city: string;
  state: string;
  consent: boolean;
}

export type BuyerFormError =
  'cpf' | 'zip' | 'street' | 'number' | 'comp' | 'city' | 'state' | 'consent';

const STATE = /^[A-Za-z]{2}$/;

/** The form as the API takes it, or the fields that are wrong (as keys, for the page to translate). */
export function toBuyerSubmission(
  form: BuyerForm,
): { data: Omit<BuyerSubmission, 'token'> } | { errors: Partial<Record<BuyerFormError, true>> } {
  const errors: Partial<Record<BuyerFormError, true>> = {};
  const street = form.street.trim();
  const number = form.number.trim();
  const comp = form.comp.trim();
  const city = form.city.trim();
  const state = form.state.trim();

  if (!isCompleteCpf(form.cpf)) errors.cpf = true;
  if (!isCompleteCep(form.zip)) errors.zip = true;
  if (street === '' || street.length > 120) errors.street = true;
  if (number === '' || number.length > 20) errors.number = true;
  if (comp.length > 60) errors.comp = true;
  if (city === '' || city.length > 80) errors.city = true;
  if (!STATE.test(state)) errors.state = true;
  if (!form.consent) errors.consent = true;
  if (Object.keys(errors).length > 0) return { errors };

  const address: BuyerAddress = {
    zip: phoneDigits(form.zip),
    street,
    number,
    comp: comp === '' ? null : comp,
    city,
    state: state.toUpperCase(),
  };
  return {
    data: {
      cpf: phoneDigits(form.cpf),
      address,
      consent: { accepted: true, version: CONSENT_VERSION },
    },
  };
}

// ---- The receipt of the payment (an image, optional)

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** As the API: 5 MB. */
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReceiptError = 'type' | 'size' | 'empty';

/** What is wrong with the file, before it is sent (`null` when it is fine). */
export function checkReceipt(file: { type: string; size: number }): ReceiptError | null {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_RECEIPT_BYTES) return 'size';
  return null;
}

// ---- The showcase of live auctions

export interface ShowcaseItem {
  key: string;
  storeId: string;
  storeName: string;
  city: string | null;
  /** The invitation link of the group of the store: the way to bid. */
  groupUrl: string | null;
  code: string;
  name: string;
  number: string;
  set: string;
  condition: string;
  language: string;
  foil: boolean;
  imageUrl: string | null;
  currentBid: string | null;
  bidCount: number;
  lastBidAt: string | null;
  endsAt: string | null;
}

export interface ShowcaseView {
  items: ShowcaseItem[];
  total: number;
  stores: { id: string; name: string }[];
}

export function normalizeShowcase(raw: unknown): ShowcaseView {
  const page = record(raw);
  return {
    items: list(page.items).map((item, index) => {
      const store = record(item.store);
      const card = record(item.card);
      return {
        key: `${text(card.short_code)}-${text(store.id)}-${index}`,
        storeId: text(store.id),
        storeName: text(store.name),
        city: orNull(store.city),
        groupUrl: orNull(store.group_url),
        code: text(card.short_code),
        name: text(card.name),
        number: text(card.number),
        set: text(card.set_name),
        condition: text(card.condition),
        language: text(card.language),
        foil: card.is_foil === true,
        imageUrl: orNull(card.image_url),
        currentBid: orNull(item.current_bid),
        bidCount: typeof item.bid_count === 'number' ? item.bid_count : 0,
        lastBidAt: orNull(item.last_bid_at),
        endsAt: orNull(item.ends_at),
      };
    }),
    total: typeof page.total === 'number' ? page.total : 0,
    stores: list(page.stores)
      .filter((store) => text(store.id) !== '')
      .map((store) => ({ id: text(store.id), name: text(store.name) })),
  };
}

// ---- The follow-up of a consignor

export interface ConsignorBid {
  amount: string;
  at: string;
  /** Already partly hidden by the API (`(11) 9••••-1020`). */
  phone: string;
}

export interface ConsignorAuction {
  status: string;
  endsAt: string | null;
  currentBid: string | null;
  bidCount: number;
  estimatedPayout: string | null;
  bids: ConsignorBid[];
}

export interface ConsignorCard {
  code: string;
  name: string;
  number: string;
  condition: string;
  language: string;
  status: string;
  commissionPct: string;
  auction: ConsignorAuction | null;
}

export interface ConsignorView {
  storeName: string;
  firstName: string;
  expiresAt: string;
  /** Until the store confirms the sale the amounts are an estimate. */
  estimateIsFinal: boolean;
  cards: ConsignorCard[];
}

function toAuction(raw: unknown): ConsignorAuction | null {
  if (raw === null || typeof raw !== 'object') return null;
  const auction = record(raw);
  return {
    status: text(auction.status),
    endsAt: orNull(auction.ends_at),
    currentBid: orNull(auction.current_bid),
    bidCount: typeof auction.bid_count === 'number' ? auction.bid_count : 0,
    estimatedPayout: orNull(auction.estimated_payout),
    bids: list(auction.bids).map((bid) => ({
      amount: text(bid.amount) || '0.00',
      at: text(bid.at),
      phone: text(bid.phone),
    })),
  };
}

export function normalizeConsignor(raw: unknown): ConsignorView {
  const page = record(raw);
  return {
    storeName: text(page.store_name),
    firstName: text(page.first_name),
    expiresAt: text(page.expires_at),
    estimateIsFinal: page.estimate_is_final === true,
    cards: list(page.cards).map((card) => ({
      code: text(card.short_code),
      name: text(card.name),
      number: text(card.number),
      condition: text(card.condition),
      language: text(card.language),
      status: text(card.card_status),
      commissionPct: text(card.commission_pct),
      auction: toAuction(card.auction),
    })),
  };
}

/** What the store keeps from the current bid: the bid minus what is passed on to the consignor. */
export function commissionOf(bid: string, payout: string): string {
  return fromCents(Math.max(0, toCents(bid) - toCents(payout)));
}

/** The 4 digits of the access key (the first digits of the CPF), or `null` when it is not complete. */
export function accessKey(value: string): string | null {
  const digits = phoneDigits(value);
  return digits.length === 4 ? digits : null;
}
