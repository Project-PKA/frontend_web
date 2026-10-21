import { createAdminApi } from '../api/admin';

/** The as-you-type search of the active accounts (by name or e-mail) for a text the page owns. */
export function useUserSearch(text: Ref<string>) {
  const api = createAdminApi(useApi());
  return useAsYouType(text, 'admin-user-search', (q, signal) =>
    api.users({ q, status: 'ACTIVE' }, undefined, signal),
  );
}
