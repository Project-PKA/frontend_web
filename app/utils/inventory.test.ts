import { describe, expect, it } from 'vitest';
import {
  auctionResult,
  cardTitle,
  filtersToQuery,
  hasFilters,
  parseFilters,
  resultTone,
  statusTone,
} from './inventory';

const auction = (status: string, winning_amount: string | null = null) => ({
  id: 'a1',
  type: 'FREE_BID',
  status,
  start_time: '2026-10-01T12:00:00Z',
  end_time: '2026-10-02T12:00:00Z',
  initial_bid: '10.00',
  winning_amount,
});

describe('parseFilters', () => {
  it('reads the filters of the address', () => {
    expect(parseFilters({ q: ' pika ', status: 'SOLD', origin: 'OWN' })).toEqual({
      q: 'pika',
      status: 'SOLD',
      origin: 'OWN',
    });
  });

  it('ignores values the API does not know and empty ones', () => {
    expect(parseFilters({ q: '  ', status: 'LOST', origin: 'STOLEN' })).toEqual({});
    expect(parseFilters({})).toEqual({});
  });

  it('takes the first of a repeated parameter and shortens a huge search', () => {
    expect(parseFilters({ status: ['SOLD', 'AVAILABLE'] }).status).toBe('SOLD');
    expect(parseFilters({ q: 'x'.repeat(500) }).q).toHaveLength(100);
  });
});

describe('filtersToQuery', () => {
  it('writes only what is set', () => {
    expect(filtersToQuery({ status: 'SOLD' })).toEqual({ status: 'SOLD' });
    expect(filtersToQuery({})).toEqual({});
  });

  it('tells whether the list is filtered', () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ origin: 'OWN' })).toBe(true);
  });
});

describe('cardTitle', () => {
  it('joins the name and the number', () => {
    expect(cardTitle({ name: 'Charizard ex', number: '199/165' })).toBe('Charizard ex 199/165');
    expect(cardTitle({ name: 'Gengar VMAX', number: '' })).toBe('Gengar VMAX');
  });
});

describe('tones', () => {
  it('gives each status its look', () => {
    expect(statusTone('AVAILABLE')).toBeUndefined();
    expect(statusTone('SCHEDULED')).toBe('info');
    expect(statusTone('AWAITING_CONFIRMATION')).toBe('warning');
    expect(statusTone('SOLD')).toBe('success');
  });
});

describe('auctionResult', () => {
  it.each([
    ['PENDING', null, 'scheduled'],
    ['ACTIVE', null, 'active'],
    ['PAUSED_FOR_VALIDATION', null, 'awaitingValidation'],
    ['FINISHED', '340.00', 'sold'],
    ['FINISHED', null, 'noWinner'],
    ['CANCELLED', null, 'cancelled'],
  ])('%s with %s is %s', (status, winning, result) => {
    expect(auctionResult(auction(status, winning))).toBe(result);
  });

  it('has a look for each result', () => {
    expect(resultTone('active')).toBe('success');
    expect(resultTone('noWinner')).toBeUndefined();
    expect(resultTone('cancelled')).toBe('danger');
  });
});
