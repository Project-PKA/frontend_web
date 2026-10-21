import { describe, expect, it } from 'vitest';
import {
  emptyToNull,
  isGroupInviteUrl,
  placeholderToken,
  placeholdersIn,
  unknownPlaceholders,
} from './settings';

describe('isGroupInviteUrl', () => {
  it('accepts the invitation link of a group', () => {
    expect(isGroupInviteUrl('https://chat.whatsapp.com/AbCdEfGhIj12')).toBe(true);
    expect(isGroupInviteUrl('  https://chat.whatsapp.com/AbCdEfGhIj12/ ')).toBe(true);
  });

  it('refuses another host, another scheme, credentials and a short code', () => {
    expect(isGroupInviteUrl('https://example.com/AbCdEfGhIj12')).toBe(false);
    expect(isGroupInviteUrl(`${'http'}://chat.whatsapp.com/AbCdEfGhIj12`)).toBe(false);
    expect(isGroupInviteUrl('https://user:pw@chat.whatsapp.com/AbCdEfGhIj12')).toBe(false);
    expect(isGroupInviteUrl('https://chat.whatsapp.com/abc')).toBe(false);
    expect(isGroupInviteUrl('https://chat.whatsapp.com.evil.example/AbCdEfGhIj12')).toBe(false);
    expect(isGroupInviteUrl('not a url')).toBe(false);
  });
});

describe('emptyToNull', () => {
  it('turns an empty field into null and trims the rest', () => {
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull('  key ')).toBe('key');
  });
});

describe('placeholders', () => {
  it('writes a placeholder between braces', () => {
    expect(placeholderToken('card')).toBe('{card}');
  });

  it('finds the placeholders of a text', () => {
    expect(placeholdersIn('Hi {card} #{short_code} {card}')).toEqual([
      'card',
      'short_code',
      'card',
    ]);
    expect(placeholdersIn('no placeholders')).toEqual([]);
  });

  it('lists the ones the message does not accept, once each', () => {
    expect(unknownPlaceholders('{card} {nope} {nope} {ends_at}', ['card', 'ends_at'])).toEqual([
      'nope',
    ]);
    expect(unknownPlaceholders('plain', [])).toEqual([]);
  });
});
