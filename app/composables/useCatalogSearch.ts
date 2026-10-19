import { createCatalogApi } from '../api/catalog';

/** The as-you-type search of the card catalog for a text the page owns. */
export function useCatalogSearch(text: Ref<string>) {
  const api = createCatalogApi(useApi());
  return useAsYouType(text, 'catalog-search', (q, signal) => api.search(q, signal));
}
