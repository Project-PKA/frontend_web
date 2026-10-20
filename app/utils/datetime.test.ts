import { describe, expect, it } from 'vitest';
import { localInputToUtc, utcToLocalInput } from './datetime';

describe('localInputToUtc', () => {
  it('reads the text in the zone of the profile', () => {
    // São Paulo is UTC-3 (no daylight time since 2019).
    expect(localInputToUtc('2026-10-18T21:30', 'America/Sao_Paulo')).toBe(
      '2026-10-19T00:30:00.000Z',
    );
    expect(localInputToUtc('2026-10-18T21:30', 'America/Manaus')).toBe('2026-10-19T01:30:00.000Z');
    expect(localInputToUtc('2026-10-18T21:30', 'UTC')).toBe('2026-10-18T21:30:00.000Z');
  });

  it('follows the daylight time of a zone that has it', () => {
    // New York: UTC-4 in July, UTC-5 in January.
    expect(localInputToUtc('2026-07-01T12:00', 'America/New_York')).toBe(
      '2026-07-01T16:00:00.000Z',
    );
    expect(localInputToUtc('2026-01-15T12:00', 'America/New_York')).toBe(
      '2026-01-15T17:00:00.000Z',
    );
  });

  it('is null for something that is not a date and time', () => {
    expect(localInputToUtc('', 'UTC')).toBeNull();
    expect(localInputToUtc('tomorrow', 'UTC')).toBeNull();
    expect(localInputToUtc('2026-10-18', 'UTC')).toBeNull();
    expect(localInputToUtc('2026-02-31T10:00', 'UTC')).toBeNull();
  });
});

describe('utcToLocalInput', () => {
  it('shows the instant in the zone of the profile', () => {
    expect(utcToLocalInput('2026-10-19T00:30:00.000Z', 'America/Sao_Paulo')).toBe(
      '2026-10-18T21:30',
    );
    expect(utcToLocalInput('2026-10-19T00:30:00Z', 'UTC')).toBe('2026-10-19T00:30');
  });

  it('goes back and forth without losing the minute', () => {
    for (const zone of ['America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon', 'Asia/Tokyo']) {
      const text = '2026-03-08T09:45';
      const iso = localInputToUtc(text, zone)!;
      expect(utcToLocalInput(iso, zone)).toBe(text);
    }
  });

  it('is empty for an unreadable instant', () => {
    expect(utcToLocalInput('nope', 'UTC')).toBe('');
  });
});
