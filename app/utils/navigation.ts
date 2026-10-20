import { decideAccess, type AccessContext, type AccessRule } from './access';

export interface NavItem {
  id: string;
  /** Translation key of the label. */
  labelKey: string;
  /** Icon of the design sprite, without the `i-` prefix. */
  icon: string;
  to: string;
  /** Who sees the item; the same rule the page declares with `definePageMeta({ access })`. */
  access: AccessRule;
}

/**
 * The menu of a store, in the order of the design. The permissions are the ones the API
 * asks for: it is the server that decides, the menu only hides what would answer 403.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', labelKey: 'nav.home', icon: 'home', to: '/home', access: { level: 'store' } },
  {
    id: 'inventory',
    labelKey: 'nav.inventory',
    icon: 'box',
    to: '/inventory',
    access: { level: 'store', permission: 'can_manage_inventory' },
  },
  {
    id: 'auctions',
    labelKey: 'nav.auctions',
    icon: 'bolt',
    to: '/auctions',
    access: { level: 'store', permission: 'can_manage_auctions' },
  },
  {
    id: 'customers',
    labelKey: 'nav.customers',
    icon: 'users',
    to: '/customers',
    access: { level: 'store', permission: 'can_manage_customers' },
  },
  {
    id: 'team',
    labelKey: 'nav.team',
    icon: 'shield',
    to: '/team',
    access: { level: 'store', owner: true },
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    icon: 'sliders',
    to: '/settings',
    access: { level: 'store', owner: true },
  },
  {
    id: 'finance',
    labelKey: 'nav.finance',
    icon: 'wallet',
    to: '/finance',
    access: { level: 'store', permission: 'can_view_finance' },
  },
];

/** The items this person can open in the current store. */
export function visibleNavItems(context: AccessContext): NavItem[] {
  return NAV_ITEMS.filter((item) => decideAccess(item.access, context).kind === 'allow');
}

/** The item is current on its own page and on the pages under it (`/inventory/new`). */
export function isCurrent(item: NavItem, path: string): boolean {
  return path === item.to || path.startsWith(`${item.to}/`);
}
