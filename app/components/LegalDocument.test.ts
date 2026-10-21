import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import LegalDocument from './LegalDocument.vue';

const props = {
  title: 'Terms of use',
  notice: 'Illustrative text, pending legal review.',
  sections: [
    { title: 'About the platform', text: 'It organizes the auctions.' },
    { title: 'Access by invitation', text: 'Access is granted by invitation.' },
  ],
  other: { label: 'Privacy policy', to: '/privacy' },
};

describe('LegalDocument', () => {
  it('shows the title, the notice and the link to the other page', () => {
    render(LegalDocument, {
      props,
      global: { stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('pending legal review');
    expect(screen.getByRole('link', { name: 'Privacy policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it('numbers the sections, each with its heading', () => {
    render(LegalDocument, {
      props,
      global: { stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      '1. About the platform',
      '2. Access by invitation',
    ]);
    expect(screen.getByText('Access is granted by invitation.')).toBeTruthy();
  });
});
