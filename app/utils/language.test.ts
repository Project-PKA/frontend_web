import { describe, expect, it } from 'vitest';
import { detectLanguage, isLanguage } from './language';

describe('detectLanguage', () => {
  it.each([
    [['pt-BR', 'en'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    [['pt'], 'pt-BR'],
    [['PT-br'], 'pt-BR'],
    [['en-US', 'pt-BR'], 'en'],
    [['fr-FR', 'pt-BR'], 'pt-BR'],
    [['fr-FR', 'de'], 'en'],
    [[], 'en'],
    [undefined, 'en'],
  ])('maps %j to %s', (preferred, expected) => {
    expect(detectLanguage(preferred as string[] | undefined)).toBe(expected);
  });
});

describe('isLanguage', () => {
  it('accepts only the supported languages', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('pt-BR')).toBe(true);
    expect(isLanguage('pt')).toBe(false);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
