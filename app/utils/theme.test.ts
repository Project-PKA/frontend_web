import { beforeEach, describe, expect, it } from 'vitest';
import { THEMES, applyTheme, isTheme } from './theme';

describe('applyTheme', () => {
  beforeEach(() => document.documentElement.removeAttribute('data-theme'));

  it('forces the dark tokens', () => {
    applyTheme('DARK', document.documentElement);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('forces the light tokens', () => {
    applyTheme('LIGHT', document.documentElement);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('follows the system by leaving the attribute out', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme('SYSTEM', document.documentElement);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('isTheme', () => {
  it('accepts the three values the API stores and nothing else', () => {
    expect(THEMES.every((theme) => isTheme(theme))).toBe(true);
    expect(isTheme('light')).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});
