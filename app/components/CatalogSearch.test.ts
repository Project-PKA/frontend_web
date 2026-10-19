import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CatalogCard } from '../api/catalog';
import CatalogSearch from './CatalogSearch.vue';

const labels = {
  label: 'Quick search: name or number',
  hint: 'Type at least 2 characters.',
  loading: 'Searching',
  none: 'No card found for zzz.',
  error: 'We could not search the catalog.',
  retry: 'Try again',
  count: '2 cards found',
};

function card(id: string, name: string, set: string, number: string): CatalogCard {
  return {
    id,
    name,
    names: {},
    number,
    set_id: null,
    set_name: set,
    image_url: `https://images.example.com/${id}/low.webp`,
    image_high_url: null,
    rarity: null,
  };
}

const RESULTS = [
  card('swsh4-044', 'Pikachu VMAX', 'Vivid Voltage', '044/185'),
  card('sv08-057', 'Pikachu ex', 'Surging Sparks', '057/191'),
];

function setup(props: Record<string, unknown> = {}) {
  const selected: CatalogCard[] = [];
  const view = render(CatalogSearch, {
    props: {
      query: 'pika',
      results: RESULTS,
      labels,
      'onUpdate:query': () => undefined,
      onSelect: (item: CatalogCard) => selected.push(item),
      ...props,
    },
  });
  return { ...view, selected, input: () => screen.getByRole('combobox', { name: labels.label }) };
}

describe('CatalogSearch', () => {
  it('is a combobox with its hint, closed until the person types or focuses', async () => {
    const { input } = setup();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().getAttribute('aria-autocomplete')).toBe('list');
    expect(screen.getByText(labels.hint)).toBeTruthy();

    await userEvent.click(input());

    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('shows each suggestion with its name, set and number', async () => {
    const { input } = setup();
    await userEvent.click(input());

    const first = screen.getAllByRole('option')[0]!;
    expect(first.textContent).toContain('Pikachu VMAX');
    expect(first.textContent).toContain('Vivid Voltage');
    expect(first.textContent).toContain('044/185');
  });

  it('keeps the focus in the field and points at the highlighted suggestion', async () => {
    const { input } = setup();
    await userEvent.click(input());

    await userEvent.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(input().getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');

    await userEvent.keyboard('{ArrowDown}');
    expect(input().getAttribute('aria-activedescendant')).toBe(options[1]!.id);

    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(input().getAttribute('aria-activedescendant')).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it('picks the highlighted suggestion with Enter and closes the list', async () => {
    const { input, selected } = setup();
    await userEvent.click(input());

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(selected.map((item) => item.id)).toEqual(['sv08-057']);
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('does not pick anything with Enter when nothing is highlighted', async () => {
    const { input, selected } = setup();
    await userEvent.click(input());

    await userEvent.keyboard('{Enter}');

    expect(selected).toEqual([]);
  });

  it('picks with the pointer', async () => {
    const { input, selected } = setup();
    await userEvent.click(input());

    await userEvent.click(screen.getAllByRole('option')[0]!);

    expect(selected.map((item) => item.id)).toEqual(['swsh4-044']);
  });

  it('closes with Escape, and clears the text with a second Escape', async () => {
    const updates: string[] = [];
    const { input } = setup({ 'onUpdate:query': (value: string) => updates.push(value) });
    await userEvent.click(input());

    await userEvent.keyboard('{Escape}');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(updates).toEqual([]);

    await userEvent.keyboard('{Escape}');
    expect(updates).toEqual(['']);
  });

  it('does not ask for a list below 2 characters', async () => {
    const { input } = setup({ query: 'p' });
    await userEvent.click(input());
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(labels.none)).toBeNull();
  });

  it('says when nothing was found', async () => {
    const { input } = setup({ results: [] });
    await userEvent.click(input());
    expect(screen.getByText(labels.none)).toBeTruthy();
  });

  it('says it is searching until the first answer', async () => {
    const { input } = setup({ results: [], loading: true });
    await userEvent.click(input());
    expect(screen.getByText(labels.loading)).toBeTruthy();
    expect(screen.queryByText(labels.none)).toBeNull();
  });

  it('shows an error with a way to try again', async () => {
    const retries: number[] = [];
    const { input } = setup({ results: [], error: true, onRetry: () => retries.push(1) });
    await userEvent.click(input());

    expect(screen.getByRole('alert').textContent).toContain(labels.error);
    await userEvent.click(screen.getByRole('button', { name: labels.retry }));

    expect(retries).toEqual([1]);
  });

  it('shows the art only from an https address and without sending a referrer', async () => {
    const odd = { ...card('x', 'Odd', 'Set', '1'), image_url: 'http://images.example.com/x.png' };
    const { input, container } = setup({ results: [RESULTS[0], odd] });
    await userEvent.click(input());

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]!.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(images[0]!.getAttribute('alt')).toBe('');
  });
});
