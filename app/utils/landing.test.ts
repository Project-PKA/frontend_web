import { describe, expect, it } from 'vitest';
import { landingPath, landingStructuredData, originOf } from './landing';

const input = {
  siteUrl: 'https://example.com/',
  locale: 'pt-BR',
  name: 'App',
  description: 'About',
  faq: [{ question: 'Q?', answer: 'A.' }],
};

describe('landingPath', () => {
  it('is / in English and under the language in the others', () => {
    expect(landingPath('en')).toBe('/');
    expect(landingPath('pt-BR')).toBe('/pt-BR');
  });
});

describe('landingStructuredData', () => {
  it('describes the application and the questions', () => {
    const data = landingStructuredData(input);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'SoftwareApplication',
      name: 'App',
      url: 'https://example.com/pt-BR',
      inLanguage: 'pt-BR',
    });
    expect(data['@graph'][1]).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ name: 'Q?', acceptedAnswer: { text: 'A.' } }],
    });
  });

  it('leaves the url out when the origin is not known', () => {
    const data = landingStructuredData({ ...input, siteUrl: '' });
    expect(data['@graph'][0]).not.toHaveProperty('url');
  });
});

describe('originOf', () => {
  it('drops the trailing slashes', () => {
    expect(originOf('https://example.com//')).toBe('https://example.com');
    expect(originOf('')).toBe('');
  });
});
