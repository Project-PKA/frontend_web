import { describe, expect, it } from 'vitest';
import { isCompleteCep, isCompleteCpf, maskCep, maskCpf } from './documents';

describe('maskCpf', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['123', '123'],
    ['1234', '123.4'],
    ['123456', '123.456'],
    ['1234567', '123.456.7'],
    ['123456789', '123.456.789'],
    ['1234567890', '123.456.789-0'],
    ['12345678901', '123.456.789-01'],
    ['123.456.789-01', '123.456.789-01'],
    ['123456789012345', '123.456.789-01'],
    ['abc123', '123'],
  ])('writes %s as %s', (typed, masked) => {
    expect(maskCpf(typed)).toBe(masked);
  });
});

describe('maskCep', () => {
  it.each([
    ['', ''],
    ['01310', '01310'],
    ['013101', '01310-1'],
    ['01310100', '01310-100'],
    ['01310-100', '01310-100'],
    ['0131010099', '01310-100'],
  ])('writes %s as %s', (typed, masked) => {
    expect(maskCep(typed)).toBe(masked);
  });
});

describe('complete documents', () => {
  it('knows when a CPF and a CEP have all their digits', () => {
    expect(isCompleteCpf('123.456.789-01')).toBe(true);
    expect(isCompleteCpf('123.456.789')).toBe(false);
    expect(isCompleteCep('01310-100')).toBe(true);
    expect(isCompleteCep('01310')).toBe(false);
  });
});
