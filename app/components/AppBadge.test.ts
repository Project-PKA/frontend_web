import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import AppBadge from './AppBadge.vue';

describe('AppBadge', () => {
  it('shows its text with the primary look by default', () => {
    render(AppBadge, { slots: { default: 'New' } });
    expect(screen.getByText('New').className).toBe('badge badge--primary');
  });

  it.each(['success', 'warning', 'danger', 'info', 'dashed'] as const)(
    'has the %s look',
    (tone) => {
      render(AppBadge, { props: { tone }, slots: { default: 'Text' } });
      expect(screen.getByText('Text').className).toContain(`badge--${tone}`);
    },
  );

  it('can pulse for live states', () => {
    render(AppBadge, { props: { tone: 'success', live: true }, slots: { default: 'Live' } });
    expect(screen.getByText('Live').className).toContain('badge--live');
  });
});
