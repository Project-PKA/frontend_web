import { createInventoryApi } from '../api/inventory';

/**
 * The as-you-type search of the cards that can go to an auction (the available ones), by #ID or
 * name, for a text the page owns.
 */
export function useAvailableCardSearch(text: Ref<string>) {
  const api = createInventoryApi(useApi());
  return useAsYouType(text, 'available-cards', (q, signal) =>
    api.list({ q, status: 'AVAILABLE' }, undefined, signal),
  );
}
