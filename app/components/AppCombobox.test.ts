import { fireEvent, render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppCombobox from './AppCombobox.vue';

interface Fruit {
  id: string;
  name: string;
}

const labels = {
  label: 'Fruit',
  hint: 'Type at least 2 characters.',
  loading: 'Searching',
  none: 'Nothing found.',
  error: 'We could not search.',
  retry: 'Try again',
  count: '3 fruits found',
};

const FRUITS: Fruit[] = [
  { id: 'a', name: 'Apple' },
  { id: 'b', name: 'Apricot' },
  { id: 'c', name: 'Avocado' },
];

function setup(props: Record<string, unknown> = {}) {
  const selected: Fruit[] = [];
  const view = render(AppCombobox, {
    props: {
      query: 'ap',
      results: FRUITS,
      labels,
      'onUpdate:query': () => undefined,
      onSelect: (item: Fruit) => selected.push(item),
      ...props,
    } as never,
    slots: { option: '<template #option="{ item }"><b>{{ item.name }}</b></template>' },
  });
  return { ...view, selected, field: () => screen.getByRole('combobox', { name: labels.label }) };
}

describe('AppCombobox', () => {
  it('shows what the option slot says for each item, whatever the item is', async () => {
    const { field } = setup();
    await userEvent.click(field());

    expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
      'Apple',
      'Apricot',
      'Avocado',
    ]);
  });

  it('jumps to the first and the last suggestion with Home and End', async () => {
    const { field } = setup();
    await userEvent.click(field());

    await userEvent.keyboard('{End}');
    expect(field().getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[2]!.id,
    );
    await userEvent.keyboard('{Home}');
    expect(field().getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]!.id,
    );
  });

  it('closes when the focus leaves the field', async () => {
    const { field } = setup();
    await userEvent.click(field());
    expect(field().getAttribute('aria-expanded')).toBe('true');

    await userEvent.tab();

    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the focus in the field when a suggestion is pressed', async () => {
    const { field } = setup();
    await userEvent.click(field());
    const option = screen.getAllByRole('option')[0]!;

    // The press is cancelled on the list, so the field does not lose the focus before the click.
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(press);

    expect(press.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field());
  });

  it('does nothing when the list is clicked outside any suggestion', async () => {
    const { field, selected } = setup();
    await userEvent.click(field());

    await fireEvent.click(screen.getByRole('listbox'));

    expect(selected).toEqual([]);
  });
});
