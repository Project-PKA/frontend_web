import { describe, expect, it } from 'vitest';
import { isBrazilPhone, maskBrazilPhone, phoneDigits } from './phone';

describe('maskBrazilPhone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['1191234', '(11) 9123-4'],
    ['119123', '(11) 9123'],
    ['1112345678', '(11) 1234-5678'],
    ['11912345678', '(11) 91234-5678'],
  ])('formats %j as %j while it is typed', (typed, expected) => {
    expect(maskBrazilPhone(typed)).toBe(expected);
  });

  it('takes a number that is already formatted, or pasted with other characters', () => {
    expect(maskBrazilPhone('(11) 91234-5678')).toBe('(11) 91234-5678');
    expect(maskBrazilPhone('+55 11 91234-5678'.replace('+55', ''))).toBe('(11) 91234-5678');
    expect(maskBrazilPhone('abc 11 9 1234 5678')).toBe('(11) 91234-5678');
  });

  it('drops digits beyond 11', () => {
    expect(maskBrazilPhone('119123456789999')).toBe('(11) 91234-5678');
  });

  it('is stable: formatting a formatted value changes nothing', () => {
    for (const value of ['(1', '(11) 9', '(11) 9123-4', '(11) 91234-5678']) {
      expect(maskBrazilPhone(value)).toBe(value);
    }
  });
});

describe('phoneDigits', () => {
  it('keeps only the digits', () => {
    expect(phoneDigits('(11) 91234-5678')).toBe('11912345678');
    expect(phoneDigits('')).toBe('');
  });
});

describe('isBrazilPhone', () => {
  it('accepts a landline and a mobile number with the area code', () => {
    expect(isBrazilPhone('(11) 1234-5678')).toBe(true);
    expect(isBrazilPhone('(11) 91234-5678')).toBe(true);
  });

  it('refuses a number that is too short or too long', () => {
    expect(isBrazilPhone('(11) 9123-4')).toBe(false);
    expect(isBrazilPhone('119123456789')).toBe(false);
    expect(isBrazilPhone('')).toBe(false);
  });
});
