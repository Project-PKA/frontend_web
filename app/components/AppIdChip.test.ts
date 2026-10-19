import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppIdChip from './AppIdChip.vue';

describe('AppIdChip', () => {
  it('is a button named by its label and shows the code with a #', () => {
    render(AppIdChip, { props: { code: '0412', label: 'Copy #0412' } });
    const button = screen.getByRole('button', { name: 'Copy #0412' });
    expect(button.textContent?.trim()).toBe('#0412');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('says which code was asked to be copied', async () => {
    const copied: string[] = [];
    render(AppIdChip, {
      props: { code: '0412', label: 'Copy #0412', onCopy: (code: string) => copied.push(code) },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Copy #0412' }));

    expect(copied).toEqual(['0412']);
  });
});
