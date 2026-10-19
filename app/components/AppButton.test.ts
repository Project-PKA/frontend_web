import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppButton from './AppButton.vue';

describe('AppButton', () => {
  it('is a button, found by its role and name, and does not submit by default', () => {
    render(AppButton, { slots: { default: 'Save' } });
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('btn--secondary');
  });

  it.each([
    ['primary', 'btn--primary'],
    ['ghost', 'btn--ghost'],
    ['danger', 'btn--danger'],
  ] as const)('has the %s look', (variant, expected) => {
    render(AppButton, { props: { variant }, slots: { default: 'Go' } });
    expect(screen.getByRole('button').className).toContain(expected);
  });

  it('has a size and a full width', () => {
    render(AppButton, { props: { size: 'lg', block: true }, slots: { default: 'Go' } });
    expect(screen.getByRole('button').className).toContain('btn--lg');
    expect(screen.getByRole('button').className).toContain('btn--block');
  });

  it('submits a form when it is a submit button', async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render({
      components: { AppButton },
      template: '<form @submit="onSubmit"><AppButton type="submit">Send</AppButton></form>',
      setup: () => ({ onSubmit }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('can be used with the keyboard', async () => {
    const onClick = vi.fn();
    render(AppButton, { attrs: { onClick }, slots: { default: 'Go' } });

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cannot be clicked while disabled', async () => {
    const onClick = vi.fn();
    render(AppButton, { props: { disabled: true }, attrs: { onClick }, slots: { default: 'Go' } });

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('cannot be used again while busy, and says so', async () => {
    const onClick = vi.fn();
    render(AppButton, { props: { busy: true }, attrs: { onClick }, slots: { default: 'Go' } });
    const button = screen.getByRole('button');

    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('takes its name from the label when it only has an icon', () => {
    render(AppButton, { props: { icon: true, label: 'Close' }, slots: { default: '<svg />' } });
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.className).toContain('btn--icon');
  });

  it('is a link that looks like a button when it has a route', () => {
    render(AppButton, { props: { to: '/login', variant: 'ghost' }, slots: { default: 'Sign in' } });
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.className).toContain('btn--ghost');
  });

  it('marks a link as unavailable while busy', () => {
    render(AppButton, { props: { to: '/x', busy: true }, slots: { default: 'Go' } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('aria-busy')).toBe('true');
  });
});
