import { describe, expect, it } from 'vitest';
import type { Auction } from '../api/auctions';
import {
  canCancel,
  editMode,
  leaderLabel,
  normalizeMoney,
  sameMoney,
  termsOf,
  termsSchema,
  toCreateBody,
  toUpdateBody,
  type Terms,
  type TermsContext,
} from './auctions';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const ZONE = 'America/Sao_Paulo';
const SCHEDULE: TermsContext = { timeZone: ZONE, now: NOW, needsStart: true };

const VALID: Terms = {
  type: 'FREE_BID',
  start: '2026-10-19T20:00',
  end: '2026-10-19T23:00',
  initial: '20',
  increment: '5',
  ceiling: '',
};

const issues = (terms: Partial<Terms>, context: TermsContext = SCHEDULE) => {
  const result = termsSchema(context).safeParse({ ...VALID, ...terms });
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
};

const auction = (overrides: Partial<Auction> = {}): Auction =>
  ({
    id: 'a1',
    type: 'FREE_BID',
    status: 'PENDING',
    start_time: '2026-10-19T23:00:00.000Z',
    end_time: '2026-10-20T02:00:00.000Z',
    initial_bid: '20.00',
    min_increment: '5.00',
    max_poll_value: null,
    ...overrides,
  }) as Auction;

describe('normalizeMoney', () => {
  it.each([
    ['25', '25'],
    ['25.5', '25.5'],
    ['25,50', '25.50'],
    [' 1234567890 ', '1234567890'],
  ])('keeps %s as the text %s', (text, expected) => {
    expect(normalizeMoney(text)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '-5', '12345678901', '1e3', '5,5,5'])('refuses %s', (text) => {
    expect(normalizeMoney(text)).toBeNull();
  });

  it('compares amounts by their cents, not by how they are written', () => {
    expect(sameMoney('20', '20.00')).toBe(true);
    expect(sameMoney('20.5', '20.50')).toBe(true);
    expect(sameMoney('20.01', '20.1')).toBe(false);
  });
});

describe('termsSchema', () => {
  it('accepts a scheduled free bid', () => {
    expect(issues({})).toEqual([]);
  });

  it('wants the dates, and the end after the start', () => {
    expect(issues({ start: '', end: '' })).toEqual([
      'end:validation.required',
      'start:validation.required',
    ]);
    expect(issues({ end: '2026-10-19T19:00' })).toEqual(['end:validation.endAfterStart']);
    expect(issues({ start: 'soon' })).toEqual(['start:validation.dateTime']);
  });

  it('does not accept an end in the past', () => {
    expect(issues({ end: '2026-10-17T10:00' }, { ...SCHEDULE, needsStart: false })).toEqual([
      'end:validation.endFuture',
    ]);
  });

  it('has no start to ask for when it starts now', () => {
    expect(issues({ start: '' }, { ...SCHEDULE, needsStart: false })).toEqual([]);
  });

  it('wants positive amounts', () => {
    expect(issues({ initial: '0', increment: 'x' })).toEqual([
      'initial:validation.money',
      'increment:validation.money',
    ]);
    expect(issues({ initial: '', increment: '' })).toEqual([
      'initial:validation.required',
      'increment:validation.required',
    ]);
  });

  it('wants a ceiling above the opening bid for a poll, and none for a free bid', () => {
    expect(issues({ type: 'POLL' })).toEqual(['ceiling:validation.required']);
    expect(issues({ type: 'POLL', ceiling: '20' })).toEqual(['ceiling:validation.ceilingAbove']);
    expect(issues({ type: 'POLL', ceiling: '500' })).toEqual([]);
    expect(issues({ type: 'FREE_BID', ceiling: 'ignored' })).toEqual([]);
  });

  it('only checks the end of an auction that is already running', () => {
    const running = { ...SCHEDULE, endOnly: true };
    expect(issues({ start: '', initial: '', increment: '' }, running)).toEqual([]);
    expect(issues({ end: '2026-10-17T10:00' }, running)).toEqual(['end:validation.endFuture']);
  });
});

describe('toCreateBody', () => {
  it('sends the instants in UTC and the amounts as the text they are', () => {
    expect(toCreateBody('c1', { ...VALID, initial: '20,5' }, SCHEDULE)).toEqual({
      card_id: 'c1',
      type: 'FREE_BID',
      start_time: '2026-10-19T23:00:00.000Z',
      end_time: '2026-10-20T02:00:00.000Z',
      initial_bid: '20.5',
      min_increment: '5',
    });
  });

  it('leaves the start out to start now, and sends the ceiling only for a poll', () => {
    const now = toCreateBody(
      'c1',
      { ...VALID, type: 'POLL', ceiling: '500' },
      {
        ...SCHEDULE,
        needsStart: false,
      },
    );
    expect(now).not.toHaveProperty('start_time');
    expect(now.max_poll_value).toBe('500');
    expect(toCreateBody('c1', { ...VALID, ceiling: '500' }, SCHEDULE)).not.toHaveProperty(
      'max_poll_value',
    );
  });
});

describe('termsOf and toUpdateBody', () => {
  it('shows the dates in the zone of the profile', () => {
    expect(termsOf(auction(), ZONE)).toMatchObject({
      start: '2026-10-19T20:00',
      end: '2026-10-19T23:00',
      initial: '20.00',
      ceiling: '',
    });
  });

  it('is empty when nothing changed, however the amounts are written', () => {
    const terms = { ...termsOf(auction(), ZONE), initial: '20', increment: '5,00' };
    expect(toUpdateBody(auction(), terms, SCHEDULE)).toEqual({});
  });

  it('sends only what changed', () => {
    const terms = { ...termsOf(auction(), ZONE), end: '2026-10-20T00:00', increment: '10' };
    expect(toUpdateBody(auction(), terms, SCHEDULE)).toEqual({
      end_time: '2026-10-20T03:00:00.000Z',
      min_increment: '10',
    });
  });

  it('sends the ceiling when it becomes a poll and clears it when it goes back to a free bid', () => {
    const toPoll = { ...termsOf(auction(), ZONE), type: 'POLL' as const, ceiling: '500' };
    expect(toUpdateBody(auction(), toPoll, SCHEDULE)).toEqual({
      type: 'POLL',
      max_poll_value: '500',
    });

    const poll = auction({ type: 'POLL', max_poll_value: '500.00' });
    const back = { ...termsOf(poll, ZONE), type: 'FREE_BID' as const, ceiling: '' };
    expect(toUpdateBody(poll, back, SCHEDULE)).toEqual({ type: 'FREE_BID', max_poll_value: null });
  });

  it('changes only the end of an auction that is running', () => {
    const terms = { ...termsOf(auction(), ZONE), end: '2026-10-20T00:00', initial: '999' };
    expect(toUpdateBody(auction(), terms, { ...SCHEDULE, endOnly: true })).toEqual({
      end_time: '2026-10-20T03:00:00.000Z',
    });
  });
});

describe('what can be done to an auction', () => {
  it.each([
    ['PENDING', 'full', true],
    ['ACTIVE', 'end', true],
    ['PAUSED_FOR_VALIDATION', 'end', true],
    ['FINISHED', 'none', false],
    ['CANCELLED', 'none', false],
  ] as const)('%s: edit %s, cancel %s', (status, mode, cancel) => {
    expect(editMode(status)).toBe(mode);
    expect(canCancel(status)).toBe(cancel);
  });
});

describe('leaderLabel', () => {
  it('joins the name and the masked phone', () => {
    expect(leaderLabel({ name: 'Rafael M.' }, '(11) *****-1020')).toBe(
      'Rafael M. · (11) *****-1020',
    );
  });

  it('is only the name without a phone, and nothing without a leader', () => {
    expect(leaderLabel({ name: 'Rafael M.' }, undefined)).toBe('Rafael M.');
    expect(leaderLabel(null, '(11) *****-1020')).toBeNull();
    expect(leaderLabel(undefined, null)).toBeNull();
  });
});
