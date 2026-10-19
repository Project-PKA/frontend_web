import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StoreCard from './StoreCard.vue';

const store = {
  to: '/home',
  name: 'Poké Card Hub',
  roleLabel: 'Owner',
  status: { on: true, text: 'WhatsApp online' },
};

describe('StoreCard', () => {
  it('is a link to where it goes, named by the store, the role and the WhatsApp state', () => {
    render(StoreCard, { props: store });
    const link = screen.getByRole('link', { name: /Poké Card Hub/ });
    expect(link.getAttribute('href')).toBe('/home');
    expect(link.textContent).toContain('Owner');
    expect(link.textContent).toContain('WhatsApp online');
  });

  it('shows the initials of the store in the art, which screen readers skip', () => {
    const { container } = render(StoreCard, { props: store });
    const art = container.querySelector('.store-card__art') as HTMLElement;
    expect(art.textContent).toBe('PC');
    expect(art.getAttribute('aria-hidden')).toBe('true');
  });

  it('takes the initials of up to two words', () => {
    const { container } = render(StoreCard, { props: { ...store, name: 'the big red card shop' } });
    expect(container.querySelector('.store-card__art')?.textContent).toBe('TB');
  });

  it('has no WhatsApp state when it is not known', () => {
    render(StoreCard, { props: { to: '/home', name: 'Hub', roleLabel: 'Staff' } });
    expect(screen.getByRole('link').textContent).not.toContain('WhatsApp');
  });

  it('marks the card in the middle of the deck', () => {
    const { container, rerender } = render(StoreCard, { props: store });
    expect(container.firstElementChild?.className).not.toContain('is-sel');

    void rerender({ selected: true });

    return Promise.resolve().then(() => {
      expect(container.firstElementChild?.className).toContain('is-sel');
    });
  });

  it('is the dashed card that creates a store', () => {
    const { container } = render(StoreCard, {
      props: { kind: 'new', to: '/stores/new', newLabel: 'Create new store' },
    });
    const link = screen.getByRole('link', { name: 'Create new store' });
    expect(link.getAttribute('href')).toBe('/stores/new');
    expect(container.firstElementChild?.className).toContain('store-card--new');
    expect(link.textContent).not.toContain('Owner');
  });

  it('says it was clicked, with the click, so the page can choose', async () => {
    const { emitted } = render(StoreCard, { props: store });

    await userEvent.click(screen.getByRole('link'));

    const [event] = emitted().select![0] as [MouseEvent];
    expect(event).toBeInstanceOf(MouseEvent);
  });

  it('makes the shine follow the pointer and puts it back when the pointer leaves', () => {
    const { container } = render(StoreCard, { props: store });
    const card = container.firstElementChild as HTMLElement;

    card.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true }));
    expect(card.style.getPropertyValue('--x')).not.toBe('');
    expect(card.style.getPropertyValue('--y')).not.toBe('');

    card.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    expect(card.style.getPropertyValue('--x')).toBe('50%');
    expect(card.style.getPropertyValue('--y')).toBe('50%');
    expect(card.style.getPropertyValue('--rx')).toBe('0deg');
    expect(card.style.getPropertyValue('--ry')).toBe('0deg');
  });
});
