import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import AppKpi from './AppKpi.vue';
import AppProgress from './AppProgress.vue';

describe('AppKpi', () => {
  it('shows the value with its label', () => {
    render(AppKpi, { props: { icon: 'bolt', value: 6, label: 'Active auctions now' } });
    expect(screen.getByText('6').className).toBe('kpi__value');
    expect(screen.getByText('Active auctions now').className).toBe('kpi__label');
  });

  it('shows a badge and a link when they are given', () => {
    render(AppKpi, {
      props: { icon: 'box', value: 3, label: 'Cards without an auction' },
      slots: { badge: '<span>reminder</span>', link: '<a href="#cards">See the cards</a>' },
    });
    expect(screen.getByText('reminder')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See the cards' })).toBeTruthy();
  });

  it('hides the decorative icon from screen readers', () => {
    const { container } = render(AppKpi, { props: { icon: 'bolt', value: 0, label: 'Active' } });
    expect(container.querySelector('.kpi__icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('AppProgress', () => {
  it('is a progress bar with its name and value', () => {
    render(AppProgress, {
      props: { value: 1, max: 4, label: 'Store setup', valueText: '1 of 4 done' },
    });
    const bar = screen.getByRole('progressbar', { name: 'Store setup' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(bar.getAttribute('aria-valuetext')).toBe('1 of 4 done');
    expect(bar.querySelector('span')?.getAttribute('style')).toContain('width: 25%');
  });

  it.each([
    [9, '100%'],
    [-2, '0%'],
  ])('never draws outside the bar (value %i)', (value, width) => {
    const { container } = render(AppProgress, { props: { value, max: 4, label: 'Setup' } });
    expect(container.querySelector('span')?.getAttribute('style')).toContain(`width: ${width}`);
  });

  it('is empty when there is nothing to count', () => {
    const { container } = render(AppProgress, { props: { value: 0, max: 0, label: 'Setup' } });
    expect(container.querySelector('span')?.getAttribute('style')).toContain('width: 0%');
  });
});
