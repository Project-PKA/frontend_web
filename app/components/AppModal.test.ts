import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppModal from './AppModal.vue';

function setup(open = true) {
  return render(AppModal, {
    props: { open, title: 'New auction', closeLabel: 'Close' },
    slots: { default: '<p>Body</p>', foot: '<button type="button">Save</button>' },
  });
}

const dialog = () => document.querySelector('dialog') as HTMLDialogElement;

describe('AppModal', () => {
  it('is a dialog named by its heading', () => {
    setup();
    expect(dialog().getAttribute('aria-labelledby')).toBe(
      screen.getByRole('heading', { name: 'New auction' }).id,
    );
  });

  it('opens as a modal dialog (the browser traps focus and makes the page inert)', () => {
    setup();
    expect(dialog().open).toBe(true);
  });

  it('stays closed until it is asked to open', () => {
    setup(false);
    expect(dialog().open).toBe(false);
  });

  it('opens and closes when the parent changes `open`', async () => {
    const { rerender } = setup(false);

    await rerender({ open: true });
    await Promise.resolve();
    expect(dialog().open).toBe(true);

    await rerender({ open: false });
    await Promise.resolve();
    expect(dialog().open).toBe(false);
  });

  it('shows its content and its foot', () => {
    setup();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save', hidden: true })).toBeTruthy();
  });

  it('asks to close from the close button', async () => {
    const { emitted } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(emitted().close).toHaveLength(1);
  });

  it('asks to close on Esc but stays open until the parent decides', () => {
    const { emitted } = setup();
    const cancel = new Event('cancel', { cancelable: true });

    dialog().dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(emitted().close).toHaveLength(1);
    expect(dialog().open).toBe(true);
  });

  it('asks to close on a click on the backdrop, not inside the content', async () => {
    const { emitted } = setup();

    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(emitted().close).toHaveLength(1);

    await userEvent.click(screen.getByText('Body'));
    expect(emitted().close).toHaveLength(1);
  });
});
