import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import AppTabs from './AppTabs.vue';

const tabs = [
  { id: 'live', label: 'Live' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'ended', label: 'Ended' },
];

function setup(initial = 'live') {
  const active = ref(initial);
  render({
    components: { AppTabs },
    template:
      '<AppTabs v-model="active" :tabs="tabs" label="Auctions"><template #default="{ active: id }"><p>Panel {{ id }}</p></template></AppTabs>',
    setup: () => ({ active, tabs }),
  });
  return { active };
}

describe('AppTabs', () => {
  it('is a named list of tabs', () => {
    setup();
    expect(screen.getByRole('tablist', { name: 'Auctions' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual([
      'Live',
      'Scheduled',
      'Ended',
    ]);
  });

  it('marks the selected tab and shows its panel, named by the tab', () => {
    setup('scheduled');
    expect(screen.getByRole('tab', { name: 'Scheduled' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Live' }).getAttribute('aria-selected')).toBe('false');
    const panel = screen.getByRole('tabpanel', { name: 'Scheduled' });
    expect(panel.textContent).toContain('Panel scheduled');
    expect(screen.getByRole('tab', { name: 'Scheduled' }).getAttribute('aria-controls')).toBe(
      panel.id,
    );
  });

  it('puts only the selected tab in the tab order', () => {
    setup();
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ]);
  });

  it('selects a tab on click', async () => {
    const { active } = setup();
    await userEvent.click(screen.getByRole('tab', { name: 'Ended' }));
    expect(active.value).toBe('ended');
    expect(screen.getByRole('tabpanel').textContent).toContain('Panel ended');
  });

  it('moves with the arrow keys, wrapping around, and focuses the new tab', async () => {
    const { active } = setup();
    screen.getByRole('tab', { name: 'Live' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(active.value).toBe('scheduled');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Scheduled' }));

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(active.value).toBe('ended');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Ended' }));

    await userEvent.keyboard('{ArrowRight}');
    expect(active.value).toBe('live');
  });

  it('goes to the first and last tab with Home and End', async () => {
    const { active } = setup('scheduled');
    screen.getByRole('tab', { name: 'Scheduled' }).focus();

    await userEvent.keyboard('{End}');
    expect(active.value).toBe('ended');
    await userEvent.keyboard('{Home}');
    expect(active.value).toBe('live');
  });

  it('ignores other keys', async () => {
    const { active } = setup();
    screen.getByRole('tab', { name: 'Live' }).focus();
    await userEvent.keyboard('a');
    expect(active.value).toBe('live');
  });
});
