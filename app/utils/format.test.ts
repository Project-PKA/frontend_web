import { describe, expect, it } from 'vitest';
import {
  browserTimeZone,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatMoney,
  formatRelative,
  formatTime,
} from './format';

const plain = (text: string) => text.replaceAll(String.fromCharCode(160), ' ');

describe('formatMoney', () => {
  it('formats a decimal string in Brazilian Portuguese', () => {
    expect(plain(formatMoney('25.50', 'pt-BR', 'BRL'))).toBe('R$ 25,50');
  });

  it('formats the same value in English', () => {
    expect(formatMoney('25.50', 'en', 'BRL')).toBe('R$25.50');
  });

  it('does not lose digits on values a number cannot hold', () => {
    expect(plain(formatMoney('9007199254740993.10', 'pt-BR', 'BRL'))).toBe(
      'R$ 9.007.199.254.740.993,10',
    );
  });

  it('formats negative amounts and whole amounts', () => {
    expect(plain(formatMoney('-3.5', 'pt-BR', 'BRL'))).toBe('-R$ 3,50');
    expect(plain(formatMoney('100', 'pt-BR', 'BRL'))).toBe('R$ 100,00');
  });

  it('returns a value that is not a decimal untouched', () => {
    expect(formatMoney('abc', 'pt-BR', 'BRL')).toBe('abc');
    expect(formatMoney('', 'pt-BR', 'BRL')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('shows a UTC instant in the time zone of the person', () => {
    const iso = '2026-10-18T02:30:00Z';
    expect(plain(formatDateTime(iso, 'pt-BR', 'America/Sao_Paulo'))).toBe('17/10/2026, 23:30');
    expect(plain(formatDateTime(iso, 'pt-BR', 'UTC'))).toBe('18/10/2026, 02:30');
  });

  it('uses the language to order the parts', () => {
    expect(plain(formatDateTime('2026-10-18T14:05:00Z', 'en', 'UTC'))).toContain('10/18/26');
  });

  it('returns an invalid date untouched', () => {
    expect(formatDateTime('not a date', 'pt-BR', 'UTC')).toBe('not a date');
  });
});

describe('formatDate', () => {
  it('formats only the day', () => {
    expect(plain(formatDate('2026-10-18T02:30:00Z', 'en', 'America/Sao_Paulo'))).toBe(
      'Oct 17, 2026',
    );
  });

  it('returns an invalid date untouched', () => {
    expect(formatDate('nope', 'en', 'UTC')).toBe('nope');
  });
});

describe('browserTimeZone', () => {
  it('returns an IANA zone name', () => {
    expect(browserTimeZone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/);
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-10-18T15:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const zone = 'America/Sao_Paulo';

  it('says how long ago, in the language asked', () => {
    expect(formatRelative(ago(12 * 60_000), 'en', now, zone)).toBe('12 minutes ago');
    expect(formatRelative(ago(3 * 3_600_000), 'en', now, zone)).toBe('3 hours ago');
    expect(formatRelative(ago(2 * 86_400_000), 'en', now, zone)).toBe('2 days ago');
    expect(formatRelative(ago(12 * 60_000), 'pt-BR', now, zone)).toBe('há 12 minutos');
  });

  it('says "now" for the last minute', () => {
    expect(formatRelative(ago(20_000), 'en', now, zone)).toBe('now');
  });

  it('shows the date and time for a moment in the future or an unreadable one', () => {
    const future = new Date(now + 60_000).toISOString();
    expect(formatRelative(future, 'en', now, zone)).toBe(formatDateTime(future, 'en', zone));
    expect(formatRelative('not a date', 'en', now, zone)).toBe('not a date');
  });
});

describe('formatTime', () => {
  it('shows the time of day with the seconds in the zone given', () => {
    expect(formatTime('2026-10-19T00:42:10Z', 'en', 'America/Sao_Paulo')).toBe('9:42:10 PM');
    expect(formatTime('2026-10-19T00:42:10Z', 'pt-BR', 'America/Sao_Paulo')).toBe('21:42:10');
  });

  it('gives back what it cannot read', () => {
    expect(formatTime('nope', 'en', 'UTC')).toBe('nope');
  });
});

describe('formatCountdown', () => {
  it.each([
    [760_000, '00:12:40'],
    [3_723_000, '01:02:03'],
    [59_999, '00:00:59'],
    [0, '00:00:00'],
    [-5_000, '00:00:00'],
    [90_000_000, '1d 01:00:00'],
    [186_760_000, '2d 03:52:40'],
  ])('writes %i ms as %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
