import { describe, expect, it } from 'vitest';
import { destination, notifyUrl, parseShipmentStatus, toShippedChanges } from './shipments';

describe('parseShipmentStatus', () => {
  it('keeps a status the API knows', () => {
    expect(parseShipmentStatus({ status: 'SHIPPED' })).toBe('SHIPPED');
    expect(parseShipmentStatus({ status: ['TO_SHIP', 'x'] })).toBe('TO_SHIP');
  });

  it('drops anything else', () => {
    expect(parseShipmentStatus({ status: 'LOST' })).toBeUndefined();
    expect(parseShipmentStatus({})).toBeUndefined();
  });
});

describe('destination', () => {
  it('joins city and state', () => {
    expect(destination({ city: 'São Paulo', state: 'SP' })).toBe('São Paulo / SP');
  });

  it('shows only what is known', () => {
    expect(destination({ city: ' ', state: 'SP' })).toBe('SP');
    expect(destination({})).toBe('');
    expect(destination(undefined)).toBe('');
  });
});

describe('toShippedChanges', () => {
  it('sends the typed code, trimmed', () => {
    expect(toShippedChanges('  BR1  ')).toEqual({ status: 'SHIPPED', tracking_code: 'BR1' });
  });

  it('does not send an empty code', () => {
    expect(toShippedChanges('  ')).toEqual({ status: 'SHIPPED' });
  });
});

describe('notifyUrl', () => {
  it('opens wa.me with the message encoded', () => {
    expect(notifyUrl('5511988771020', 'Hi & bye')).toBe(
      'https://wa.me/5511988771020?text=Hi%20%26%20bye',
    );
  });
});
