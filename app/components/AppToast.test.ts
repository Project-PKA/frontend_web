import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppToast from './AppToast.vue';

function setup(
  props: { tone?: 'success' | 'info' | 'warning' | 'danger'; duration?: number } = {},
) {
  return render(AppToast, { props: { message: 'Saved', closeLabel: 'Dismiss', ...props } });
}

describe('AppToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows its message with the look of its tone', () => {
    const { container } = setup({ tone: 'success' });
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('alert--success');
  });

  it('can be dismissed with its button', async () => {
    const { emitted } = render(AppToast, { props: { message: 'Saved', closeLabel: 'Dismiss' } });
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(emitted().dismiss).toHaveLength(1);
  });

  it('goes away by itself after its duration', () => {
    const { emitted } = setup({ duration: 5000 });

    vi.advanceTimersByTime(4999);
    expect(emitted().dismiss).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(emitted().dismiss).toHaveLength(1);
  });

  it('stays until dismissed when its duration is 0', () => {
    const { emitted } = setup({ duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(emitted().dismiss).toBeUndefined();
  });

  it('waits while the pointer is over it and resumes with the time that was left', async () => {
    const { emitted, container } = setup({ duration: 5000 });
    const toast = container.firstElementChild as HTMLElement;

    vi.advanceTimersByTime(3000);
    toast.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(60_000);
    expect(emitted().dismiss).toBeUndefined();

    toast.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(1999);
    expect(emitted().dismiss).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(emitted().dismiss).toHaveLength(1);
  });

  it('waits while it has keyboard focus', () => {
    const { emitted, container } = setup({ duration: 1000 });
    const toast = container.firstElementChild as HTMLElement;

    toast.dispatchEvent(new Event('focusin', { bubbles: true }));
    vi.advanceTimersByTime(10_000);
    expect(emitted().dismiss).toBeUndefined();

    toast.dispatchEvent(new Event('focusout', { bubbles: true }));
    vi.advanceTimersByTime(1000);
    expect(emitted().dismiss).toHaveLength(1);
  });

  it('does not dismiss after it was removed', () => {
    const { emitted, unmount } = setup({ duration: 1000 });
    unmount();
    vi.advanceTimersByTime(5000);
    expect(emitted().dismiss).toBeUndefined();
  });
});
