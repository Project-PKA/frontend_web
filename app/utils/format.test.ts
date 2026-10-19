import { describe, expect, it } from 'vitest';
import { browserTimeZone, formatDate, formatDateTime, formatMoney } from './format';

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
