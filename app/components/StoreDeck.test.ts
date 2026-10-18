import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import StoreDeck from './StoreDeck.vue';

const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockClear();
  HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
});

async function setup(options: { selected?: number; count?: number } = {}) {
  const selected = ref(options.selected ?? 0);
  const count = options.count ?? 3;
  const cards = Array.from(
    { length: count },
    (_, index) => `<a class="store-card" href="/s/${index}">Store ${index}</a>`,
  ).join('');
  render({
    components: { StoreDeck },
    template: `<StoreDeck v-model:selected="selected" label="Stores" previous-label="Previous store" next-label="Next store" :count="count">${cards}</StoreDeck>`,
    setup: () => ({ selected, count }),
  });
  // The deck centers its first card once it is mounted: wait for that, then count only what a test does.
  await flushPromises();
  scrollTo.mockClear();
  const deck = screen.getByRole('group', { name: 'Stores' });
  return { selected, deck };
}

describe('StoreDeck', () => {
  it('is a named group the keyboard can reach, with its cards inside', async () => {
    const { deck } = await setup();
    expect(deck.getAttribute('tabindex')).toBe('0');
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(deck.contains(screen.getByRole('link', { name: 'Store 1' }))).toBe(true);
  });

  it('has a dot for each card and lights the selected one, for the eyes only', () => {
    const { container } = render(StoreDeck, {
      props: {
        label: 'Stores',
        previousLabel: 'Previous',
        nextLabel: 'Next',
        count: 3,
        selected: 1,
      },
    });
    const dots = container.querySelectorAll('.dots i');
    expect(dots).toHaveLength(3);
    expect(dots[1]?.className).toBe('is-on');
    expect(container.querySelector('.dots')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('cannot go before the first card', async () => {
    await setup({ selected: 0 });
    expect(
      (screen.getByRole('button', { name: 'Previous store' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Next store' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('cannot go past the last card', async () => {
    const { selected } = await setup();
    // The deck measures its own cards when it mounts (all zeros here), so set the card afterwards.
    selected.value = 2;
    await flushPromises();
    expect((screen.getByRole('button', { name: 'Next store' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Previous store' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('scrolls to the next card with its button', async () => {
    await setup({ selected: 0 });

    await userEvent.click(screen.getByRole('button', { name: 'Next store' }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('scrolls to the previous card with its button', async () => {
    const { selected } = await setup();
    // The deck measures its own cards when it mounts (all zeros here), so set the card afterwards.
    selected.value = 2;
    await flushPromises();

    await userEvent.click(screen.getByRole('button', { name: 'Previous store' }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('moves with the arrow keys when the deck itself has focus', async () => {
    const { deck } = await setup();
    deck.focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');

    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('leaves the arrow keys alone when a card has focus', async () => {
    await setup();
    screen.getByRole('link', { name: 'Store 0' }).focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('brings a card that is not in the middle to the middle on a pointer click, without choosing it', async () => {
    await setup();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });

    screen.getByRole('link', { name: 'Store 2' }).dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('lets a click on the card in the middle through', async () => {
    await setup();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });

    screen.getByRole('link', { name: 'Store 0' }).dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('lets the keyboard choose a card at once', async () => {
    await setup();
    const enter = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });

    screen.getByRole('link', { name: 'Store 2' }).dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(false);
  });
});
