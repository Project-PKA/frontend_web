import { describe, expect, it } from 'vitest';
import { tokenFromFragment } from './fragment-token';

const token = 'a'.repeat(43);

describe('tokenFromFragment', () => {
  it('reads the token of the fragment', () => {
    expect(tokenFromFragment(`#token=${token}`)).toBe(token);
  });

  it('accepts a fragment without the #', () => {
    expect(tokenFromFragment(`token=${token}`)).toBe(token);
  });

  it('keeps the characters a token is made of', () => {
    const urlSafe = 'AbC-_123'.repeat(5);
    expect(tokenFromFragment(`#token=${urlSafe}`)).toBe(urlSafe);
  });

  it('ignores other parameters in the fragment', () => {
    expect(tokenFromFragment(`#utm=x&token=${token}&y=1`)).toBe(token);
  });

  it.each([
    ['an empty fragment', ''],
    ['just the #', '#'],
    ['no token', '#other=1'],
    ['an empty token', '#token='],
    ['a token that is too short', '#token=short'],
    ['a token that is too long', `#token=${'a'.repeat(201)}`],
  ])('finds nothing in %s', (_label, hash) => {
    expect(tokenFromFragment(hash)).toBeNull();
  });

  it('is at the edge of the lengths the API takes', () => {
    expect(tokenFromFragment(`#token=${'a'.repeat(20)}`)).not.toBeNull();
    expect(tokenFromFragment(`#token=${'a'.repeat(19)}`)).toBeNull();
    expect(tokenFromFragment(`#token=${'a'.repeat(200)}`)).not.toBeNull();
  });
});
