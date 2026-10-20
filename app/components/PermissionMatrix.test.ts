import { fireEvent, render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import PermissionMatrix from './PermissionMatrix.vue';

const labels = {
  can_manage_inventory: 'Manage inventory',
  can_manage_auctions: 'Manage auctions',
  can_manage_customers: 'Manage customers',
  can_view_finance: 'View the finance dashboard',
  can_delete: 'Delete records',
};
const value = {
  can_manage_inventory: true,
  can_manage_auctions: true,
  can_manage_customers: false,
  can_view_finance: false,
  can_delete: false,
};

describe('PermissionMatrix', () => {
  it('shows one switch per permission, in the order of the design, with their state', () => {
    render(PermissionMatrix, {
      props: { modelValue: value, labels, blockedNote: 'Blocked by default' },
    });
    const switches = screen.getAllByRole('switch') as HTMLInputElement[];
    expect(switches.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Manage inventory',
      'Manage auctions',
      'Manage customers',
      'View the finance dashboard',
      'Delete records',
    ]);
    expect(switches.map((item) => item.checked)).toEqual([true, true, false, false, false]);
  });

  it('says that deleting is blocked by default', () => {
    render(PermissionMatrix, {
      props: { modelValue: value, labels, blockedNote: 'Blocked by default' },
    });
    expect(screen.getAllByText('Blocked by default')).toHaveLength(1);
  });

  it('gives back the whole map with the one that changed', async () => {
    const { emitted } = render(PermissionMatrix, {
      props: { modelValue: value, labels, blockedNote: 'x' },
    });
    await fireEvent.click(screen.getByRole('switch', { name: 'View the finance dashboard' }));
    expect(emitted()['update:modelValue']![0]).toEqual([{ ...value, can_view_finance: true }]);
  });

  it('does not change while it is disabled', () => {
    render(PermissionMatrix, {
      props: { modelValue: value, labels, blockedNote: 'x', disabled: true },
    });
    for (const item of screen.getAllByRole('switch') as HTMLInputElement[]) {
      expect(item.disabled).toBe(true);
    }
  });
});
