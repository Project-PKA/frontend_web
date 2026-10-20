import { z } from 'zod';
import type { Auction, AuctionStatus, CreateAuction, UpdateAuction } from '../api/auctions';
import { localInputToUtc, utcToLocalInput } from './datetime';

/** What the API accepts for an amount in reais: up to 10 digits and 2 decimals ("25.50"). */
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * An amount a person typed ("25", "25.5", "25,50") as the decimal string the API wants. Never a
 * `number`: the text is only cleaned (a comma becomes the dot). `null` when it is not an amount.
 */
export function normalizeMoney(text: string): string | null {
  const cleaned = text.trim().replace(',', '.');
  return MONEY.test(cleaned) ? cleaned : null;
}

/** An amount in whole cents, to compare two amounts without floating point. */
function cents(amount: string): number {
  const [whole = '0', fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export const sameMoney = (a: string, b: string) => cents(a) === cents(b);

export interface TermsContext {
  /** The time zone of the profile: the dates are typed and shown in it. */
  timeZone: string;
  /** The current instant, in milliseconds (a parameter so tests do not depend on the clock). */
  now: number;
  /** The start is typed (Schedule); when false the auction starts now and has none. */
  needsStart: boolean;
  /** Only the end can change (an auction already running): the rest is not validated. */
  endOnly?: boolean;
}

type Problem = (path: string, message: string) => void;
type RawTerms = {
  type: 'FREE_BID' | 'POLL';
  start: string;
  end: string;
  initial: string;
  increment: string;
  ceiling: string;
};

/** The end must be an instant in the future; with a start, after it. */
function checkDates(terms: RawTerms, context: TermsContext, problem: Problem) {
  const end = localInputToUtc(terms.end, context.timeZone);
  if (terms.end.trim() === '') problem('end', 'validation.required');
  else if (end === null) problem('end', 'validation.dateTime');
  else if (new Date(end).getTime() <= context.now) problem('end', 'validation.endFuture');
  if (context.endOnly || !context.needsStart) return;

  const start = localInputToUtc(terms.start, context.timeZone);
  if (terms.start.trim() === '') problem('start', 'validation.required');
  else if (start === null) problem('start', 'validation.dateTime');
  else if (end !== null && new Date(end).getTime() <= new Date(start).getTime()) {
    problem('end', 'validation.endAfterStart');
  }
}

/** An amount field: filled, a valid amount, and above zero. */
function checkAmount(text: string, path: string, problem: Problem) {
  const amount = normalizeMoney(text);
  if (text.trim() === '') problem(path, 'validation.required');
  else if (amount === null || cents(amount) <= 0) problem(path, 'validation.money');
}

/** A poll has a ceiling above the opening bid; a free bid has none. */
function checkCeiling(terms: RawTerms, problem: Problem) {
  if (terms.type !== 'POLL') return;
  const ceiling = normalizeMoney(terms.ceiling);
  const initial = normalizeMoney(terms.initial);
  if (terms.ceiling.trim() === '') problem('ceiling', 'validation.required');
  else if (ceiling === null) problem('ceiling', 'validation.money');
  else if (initial !== null && cents(ceiling) <= cents(initial)) {
    problem('ceiling', 'validation.ceilingAbove');
  }
}

/** The fields of the terms of an auction. Messages are translation keys. */
export function termsSchema(context: TermsContext) {
  return z
    .object({
      type: z.enum(['FREE_BID', 'POLL'], { error: 'validation.required' }),
      start: z.string(),
      end: z.string(),
      initial: z.string(),
      increment: z.string(),
      ceiling: z.string(),
    })
    .superRefine((terms, ctx) => {
      const problem: Problem = (path, message) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      checkDates(terms, context, problem);
      if (context.endOnly) return;
      checkAmount(terms.initial, 'initial', problem);
      checkAmount(terms.increment, 'increment', problem);
      checkCeiling(terms, problem);
    });
}

export type Terms = z.output<ReturnType<typeof termsSchema>>;

/**
 * The body of `POST /v1/auctions`. The start is left out to start now; the ceiling only goes for a
 * poll. The values were checked by `termsSchema`, so a `null` here would be a bug.
 */
export function toCreateBody(cardId: string, terms: Terms, context: TermsContext): CreateAuction {
  const body: CreateAuction = {
    card_id: cardId,
    type: terms.type,
    end_time: localInputToUtc(terms.end, context.timeZone) ?? '',
    initial_bid: normalizeMoney(terms.initial) ?? '',
    min_increment: normalizeMoney(terms.increment) ?? '',
  };
  if (context.needsStart) body.start_time = localInputToUtc(terms.start, context.timeZone) ?? '';
  if (terms.type === 'POLL') body.max_poll_value = normalizeMoney(terms.ceiling);
  return body;
}

/** The form's fields for an auction that already exists, the dates in the zone of the profile. */
export function termsOf(auction: Auction, timeZone: string): Terms {
  return {
    type: auction.type,
    start: utcToLocalInput(auction.start_time, timeZone),
    end: utcToLocalInput(auction.end_time, timeZone),
    initial: auction.initial_bid,
    increment: auction.min_increment,
    ceiling: auction.max_poll_value ?? '',
  };
}

/**
 * What changed, for `PATCH /v1/auctions/{id}`: the API changes only what it receives, and an
 * auction already running accepts only the end. Empty when nothing changed.
 */
export function toUpdateBody(auction: Auction, terms: Terms, context: TermsContext): UpdateAuction {
  const changes: UpdateAuction = {};
  const end = localInputToUtc(terms.end, context.timeZone);
  if (end !== null && new Date(end).getTime() !== new Date(auction.end_time).getTime()) {
    changes.end_time = end;
  }
  if (context.endOnly) return changes;

  const start = localInputToUtc(terms.start, context.timeZone);
  if (start !== null && new Date(start).getTime() !== new Date(auction.start_time).getTime()) {
    changes.start_time = start;
  }
  if (terms.type !== auction.type) changes.type = terms.type;
  const initial = normalizeMoney(terms.initial);
  if (initial !== null && !sameMoney(initial, auction.initial_bid)) changes.initial_bid = initial;
  const increment = normalizeMoney(terms.increment);
  if (increment !== null && !sameMoney(increment, auction.min_increment)) {
    changes.min_increment = increment;
  }
  const ceiling = terms.type === 'POLL' ? normalizeMoney(terms.ceiling) : null;
  const before = auction.max_poll_value;
  const ceilingChanged =
    ceiling === null || before === null ? ceiling !== before : !sameMoney(ceiling, before);
  if (ceilingChanged && (terms.type === 'POLL' || before !== null)) {
    changes.max_poll_value = ceiling;
  }
  return changes;
}

/** The tabs of the list and the status each one asks the API for. */
export const AUCTION_TABS = ['active', 'scheduled', 'finished', 'cancelled'] as const;
export type AuctionTab = (typeof AUCTION_TABS)[number];

export const TAB_STATUS: Record<AuctionTab, AuctionStatus> = {
  active: 'ACTIVE',
  scheduled: 'PENDING',
  finished: 'FINISHED',
  cancelled: 'CANCELLED',
};

/** Who can still be changed: a scheduled auction fully, one that is running only its end. */
export function editMode(status: AuctionStatus): 'full' | 'end' | 'none' {
  if (status === 'PENDING') return 'full';
  if (status === 'ACTIVE' || status === 'PAUSED_FOR_VALIDATION') return 'end';
  return 'none';
}

/** An auction can be cancelled until it finishes. */
export function canCancel(status: AuctionStatus): boolean {
  return status === 'PENDING' || status === 'ACTIVE' || status === 'PAUSED_FOR_VALIDATION';
}

/** "Rafael M. · (11) *****-1020": who is ahead, with the masked phone when the bids have it. */
export function leaderLabel(
  leader: { name: string } | null | undefined,
  phone: string | null | undefined,
): string | null {
  if (!leader) return null;
  return phone ? `${leader.name} · ${phone}` : leader.name;
}
