import { render, screen, within } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppSideNav from './AppSideNav.vue';

const props = {
  brand: 'pokemonAuction',
  navLabel: 'Main',
  items: [
    { id: 'home', label: 'Home', icon: 'home', to: '/home', current: true },
    { id: 'inventory', label: 'Inventory', icon: 'box', to: '/inventory', current: false },
  ],
  storeName: 'Card Hub',
  storeRole: 'Owner',
  storeLabel: 'Store Card Hub, Owner. Change store',
  account: {
    email: 'igor@example.com',
    text: 'View profile',
    label: 'Profile of igor@example.com',
  },
};

describe('AppSideNav', () => {
  it('has a named navigation with one link per item', () => {
    render(AppSideNav, { props });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/home', '/inventory']);
  });

  it('marks the current page, and only that one', () => {
    render(AppSideNav, { props });
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Inventory' }).getAttribute('aria-current')).toBeNull();
  });

  it('names every link even when the text is hidden in the compact menu', () => {
    render(AppSideNav, { props });
    const links = screen.getAllByRole('link');
    expect(links.every((link) => (link.getAttribute('aria-label') ?? '').length > 0)).toBe(true);
    expect(screen.getByRole('link', { name: 'pokemonAuction' }).getAttribute('href')).toBe('/home');
  });

  it('goes back to the choice of store from the store, with its name and role', () => {
    render(AppSideNav, { props });
    const link = screen.getByRole('link', { name: 'Store Card Hub, Owner. Change store' });
    expect(link.getAttribute('href')).toBe('/stores');
    expect(link.textContent).toContain('Card Hub');
    expect(link.textContent).toContain('Owner');
  });

  it('goes to the profile from the footer, naming the account', () => {
    render(AppSideNav, { props });
    const link = screen.getByRole('link', { name: 'Profile of igor@example.com' });
    expect(link.getAttribute('href')).toBe('/profile');
    expect(link.textContent).toContain('igor@example.com');
  });

  it('says a link was used, so the drawer can close', async () => {
    const { emitted } = render(AppSideNav, { props });

    await userEvent.click(screen.getByRole('link', { name: 'Inventory' }));
    await userEvent.click(screen.getByRole('link', { name: 'pokemonAuction' }));

    expect(emitted().navigate).toHaveLength(2);
  });

  it('shows an empty menu when the person can open nothing', () => {
    render(AppSideNav, { props: { ...props, items: [] } });
    expect(within(screen.getByRole('navigation')).queryAllByRole('link')).toEqual([]);
  });

  it('leaves out the store and leads elsewhere when it is not the app of a store', () => {
    render(AppSideNav, {
      props: {
        brand: 'Admin',
        navLabel: 'Admin',
        items: [],
        home: '/admin',
        account: {
          email: 'igor@example.com',
          text: 'Back to the stores',
          label: 'Back to the stores, as igor@example.com',
          to: '/stores',
        },
      },
    });
    expect(screen.queryByRole('link', { name: /Change store/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
    expect(
      screen
        .getByRole('link', { name: 'Back to the stores, as igor@example.com' })
        .getAttribute('href'),
    ).toBe('/stores');
  });
});
