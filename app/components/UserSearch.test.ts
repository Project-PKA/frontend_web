import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AdminUser } from '../api/admin';
import UserSearch from './UserSearch.vue';

const labels = {
  label: 'New owner',
  hint: 'Search by name or e-mail.',
  loading: 'Searching',
  none: 'No user found.',
  error: 'We could not search.',
  retry: 'Try again',
  count: '2 users found',
};

const user = (id: string, email: string, name: string | null) => ({ id, email, name }) as AdminUser;

describe('UserSearch', () => {
  it('shows the name and the e-mail of each suggestion, and the e-mail alone without a name', async () => {
    render(UserSearch, {
      props: {
        query: 'ana',
        results: [user('u1', 'ana@example.com', 'Ana Souza'), user('u2', 'leo@example.com', null)],
        labels,
        'onUpdate:query': () => undefined,
      },
    });
    await userEvent.click(screen.getByRole('combobox', { name: 'New owner' }));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]!.textContent).toContain('Ana Souza');
    expect(options[0]!.textContent).toContain('ana@example.com');
    expect(options[1]!.textContent).toContain('leo@example.com');
  });

  it('says which user was picked', async () => {
    const picked: AdminUser[] = [];
    render(UserSearch, {
      props: {
        query: 'ana',
        results: [user('u1', 'ana@example.com', 'Ana Souza')],
        labels,
        'onUpdate:query': () => undefined,
        onSelect: (item: AdminUser) => picked.push(item),
      },
    });
    await userEvent.click(screen.getByRole('combobox', { name: 'New owner' }));
    await userEvent.click(screen.getByRole('option'));
    expect(picked.map((item) => item.id)).toEqual(['u1']);
  });
});
