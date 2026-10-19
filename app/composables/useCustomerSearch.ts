import { createCustomersApi } from '../api/customers';

/** The as-you-type search of the store's customers (by name, phone or CPF) for a text the page owns. */
export function useCustomerSearch(text: Ref<string>) {
  const api = createCustomersApi(useApi());
  return useAsYouType(text, 'customer-search', (q, signal) => api.search(q, signal));
}
