import { describe, expect, it } from 'vitest';
import { timeZoneOptions } from './timezones';

describe('timeZoneOptions', () => {
  it('lists the zones of the browser, including São Paulo', () => {
    expect(timeZoneOptions('America/Sao_Paulo')).toContain('America/Sao_Paulo');
  });

  it('keeps a saved zone even when the browser does not list it', () => {
    const options = timeZoneOptions('Mars/Olympus_Mons');
    expect(options[0]).toBe('Mars/Olympus_Mons');
    expect(options.length).toBeGreaterThan(1);
  });

  it('does not repeat the current zone', () => {
    const options = timeZoneOptions('America/Manaus');
    expect(options.filter((zone) => zone === 'America/Manaus')).toHaveLength(1);
  });
});
