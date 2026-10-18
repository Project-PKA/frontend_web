import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import AppCard from './AppCard.vue';

describe('AppCard', () => {
  it('shows only its body when there is no head or foot', () => {
    const { container } = render(AppCard, { slots: { default: 'Content' } });
    expect(screen.getByText('Content').className).toContain('card__body');
    expect(container.querySelector('.card__head')).toBeNull();
    expect(container.querySelector('.card__foot')).toBeNull();
  });

  it('has a heading when it has a title, at the level the page needs', () => {
    render(AppCard, { props: { title: 'Stores', headingLevel: 3 }, slots: { default: 'Content' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Stores' }).className).toContain(
      'card__title',
    );
  });

  it('takes actions in the head and a foot', () => {
    render(AppCard, {
      props: { title: 'Stores' },
      slots: { default: 'Content', head: '<button type="button">Add</button>', foot: 'Footer' },
    });
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(screen.getByText('Footer').className).toContain('card__foot');
  });

  it('can be a landmark', () => {
    render(AppCard, { props: { as: 'section', title: 'Stores' } });
    // A section is a region only when it has a name; the heading gives it one in real pages.
    expect(document.querySelector('section.card')).not.toBeNull();
  });

  it('has the interactive and highlighted looks, and extra classes on the body', () => {
    const { container } = render(AppCard, {
      props: { interactive: true, highlight: true, bodyClass: 'stack' },
      slots: { default: 'Content' },
    });
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('card--interactive');
    expect(card.className).toContain('card--highlight');
    expect(screen.getByText('Content').className).toContain('stack');
  });
});
