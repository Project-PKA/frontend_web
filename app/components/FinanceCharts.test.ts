import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import FinanceBars from './FinanceBars.vue';
import FinanceLineChart from './FinanceLineChart.vue';
import FinancePie from './FinancePie.vue';

describe('FinanceLineChart', () => {
  const days = [
    { label: '1', revenue: 10000, profit: 6000 },
    { label: '2', revenue: 30000, profit: 20000 },
    { label: '3', revenue: 20000, profit: 12000 },
  ];

  it('draws the revenue and the profit lines and names the chart', () => {
    const { container } = render(FinanceLineChart, {
      props: { days, label: 'Revenue per day', formatTick: (cents: number) => `R${cents / 100}` },
    });
    expect(screen.getByRole('img', { name: 'Revenue per day' })).toBeTruthy();
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(container.querySelector('polygon')).toBeTruthy();
    // The axis goes up to a round value above the best day: 500 for 300.
    expect(screen.getByText('R500')).toBeTruthy();
    expect(screen.getByText('R0')).toBeTruthy();
  });

  it('labels the days, but not all of them when there are many', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      label: String(index + 1),
      revenue: 100,
      profit: 50,
    }));
    const { container } = render(FinanceLineChart, {
      props: { days: many, label: 'x', formatTick: () => '' },
    });
    const names = [...container.querySelectorAll('text.ax')].filter(
      (node) => node.getAttribute('y') === '214',
    );
    expect(names.length).toBeLessThan(30);
    expect(names.at(-1)?.textContent?.trim()).toBe('30');
  });
});

describe('FinanceBars', () => {
  const bars = [
    { label: '<50', value: 14 },
    { label: '50-100', value: 42 },
    { label: '>100', value: 0 },
  ];

  it('draws a bar per value with its count, highlighting the highest', () => {
    const { container } = render(FinanceBars, { props: { bars, label: 'Sales by price' } });
    expect(screen.getByRole('img', { name: 'Sales by price' })).toBeTruthy();
    const rects = [...container.querySelectorAll('rect')];
    expect(rects).toHaveLength(3);
    expect(rects.map((rect) => rect.getAttribute('fill'))).toEqual([
      'var(--primary)',
      'var(--success)',
      'var(--primary)',
    ]);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('50-100')).toBeTruthy();
  });

  it('names only every n-th bar and leaves the counts out when asked', () => {
    const hours = Array.from({ length: 6 }, (_, hour) => ({ label: `${hour}h`, value: hour }));
    render(FinanceBars, { props: { bars: hours, label: 'Hours', labelEvery: 3 } });
    expect(screen.getByText('0h')).toBeTruthy();
    expect(screen.getByText('3h')).toBeTruthy();
    expect(screen.queryByText('1h')).toBeNull();
    expect(screen.queryByText('4')).toBeNull();
  });
});

describe('FinancePie', () => {
  it('draws a wedge per part and lists the shares in the legend', () => {
    const { container } = render(FinancePie, {
      props: {
        label: 'By origin',
        items: [
          { label: 'Own', value: 5800 },
          { label: 'Consigned', value: 4200 },
        ],
      },
    });
    expect(screen.getByRole('img', { name: 'By origin' })).toBeTruthy();
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(screen.getByText('Own')).toBeTruthy();
    expect(screen.getByText('58%')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('fills the circle for a single part and keeps the parts at zero in the legend', () => {
    const { container } = render(FinancePie, {
      props: {
        label: 'By language',
        items: [
          { label: 'Portuguese', value: 900 },
          { label: 'English', value: 0 },
        ],
      },
    });
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });
});
