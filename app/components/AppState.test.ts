import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppDataState from './AppDataState.vue';
import AppState from './AppState.vue';

describe('AppState', () => {
  it('announces loading politely and says it is busy', () => {
    render(AppState, { props: { kind: 'loading', title: 'Loading cards' } });
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Loading cards');
    expect(status.getAttribute('aria-busy')).toBe('true');
  });

  it('shows an empty state with a heading, a text and an action', async () => {
    const { emitted } = render(AppState, {
      props: {
        kind: 'empty',
        title: 'No cards yet',
        text: 'Register the first one.',
        actionLabel: 'Register a card',
      },
    });

    expect(screen.getByRole('heading', { level: 3, name: 'No cards yet' })).toBeTruthy();
    expect(screen.getByText('Register the first one.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Register a card' }));
    expect(emitted().action).toHaveLength(1);
  });

  it('uses the heading level the page needs', () => {
    render(AppState, { props: { kind: 'empty', title: 'Nothing here', headingLevel: 2 } });
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('has no button when there is no action', () => {
    render(AppState, { props: { kind: 'empty', title: 'Nothing here' } });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an error as an alert with a way to try again', async () => {
    const { emitted } = render(AppState, {
      props: {
        kind: 'error',
        title: 'Could not load',
        text: 'Check the connection.',
        actionLabel: 'Try again',
      },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not load');
    expect(alert.textContent).toContain('Check the connection.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(emitted().action).toHaveLength(1);
  });
});

describe('AppDataState', () => {
  const labels = {
    loading: 'Loading',
    emptyTitle: 'Empty',
    emptyText: 'Nothing yet',
    errorTitle: 'Failed',
    retry: 'Retry',
  };
  const slots = { default: '<p>The content</p>' };

  it('shows the content when everything is fine', () => {
    render(AppDataState, { props: { labels }, slots });
    expect(screen.getByText('The content')).toBeTruthy();
  });

  it('shows loading before anything else', () => {
    render(AppDataState, { props: { labels, loading: true, error: true, empty: true }, slots });
    expect(screen.getByRole('status').textContent).toContain('Loading');
    expect(screen.queryByText('The content')).toBeNull();
  });

  it('shows the error before the empty state, and retries', async () => {
    const { emitted } = render(AppDataState, {
      props: { labels, error: true, empty: true },
      slots,
    });

    expect(screen.getByRole('alert').textContent).toContain('Failed');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(emitted().retry).toHaveLength(1);
  });

  it('shows the empty state when there is nothing to show', () => {
    render(AppDataState, { props: { labels, empty: true }, slots });
    expect(screen.getByRole('heading', { name: 'Empty' })).toBeTruthy();
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    expect(screen.queryByText('The content')).toBeNull();
  });
});
