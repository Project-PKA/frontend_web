import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppSwitch from './AppSwitch.vue';

describe('AppSwitch', () => {
  it('is a switch named by its label', () => {
    render(AppSwitch, { slots: { default: 'Daily summary' } });
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Daily summary' }).checked).toBe(
      false,
    );
  });

  it('shows the value it was given', () => {
    render(AppSwitch, { props: { modelValue: true }, slots: { default: 'Daily summary' } });
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Daily summary' }).checked).toBe(
      true,
    );
  });

  it('tells the parent when it is toggled', async () => {
    const updates: boolean[] = [];
    render(AppSwitch, {
      props: { modelValue: false, 'onUpdate:modelValue': (value: boolean) => updates.push(value) },
      slots: { default: 'Daily summary' },
    });
    await userEvent.click(screen.getByRole('switch', { name: 'Daily summary' }));
    expect(updates).toEqual([true]);
  });

  it('cannot be toggled when disabled', () => {
    render(AppSwitch, { props: { disabled: true }, slots: { default: 'Daily summary' } });
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Daily summary' }).disabled).toBe(
      true,
    );
  });
});
