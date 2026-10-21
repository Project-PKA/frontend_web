import type { paths } from './generated';
import type { ApiClient } from './client';

export type ShowcaseSort = 'ENDING_SOON' | 'HIGHEST_BID' | 'MOST_BIDS' | 'NEWEST';
export interface ShowcaseFilters {
  store?: string;
  language?: string;
  sort?: ShowcaseSort;
}

/** The biggest page the API gives, and how far it goes (`limit <= 48`, `offset <= 480`). */
export const SHOWCASE_PAGE = 24;
export const SHOWCASE_MAX_OFFSET = 480;

/** The data the buyer fills in on the settlement page. */
export type BuyerSubmission =
  paths['/v1/public/settlement/data']['post']['requestBody']['content']['application/json'];
export type BuyerAddress = BuyerSubmission['address'];

/**
 * The pages anyone can open with a link (ADR 0014): the settlement of a buyer and the follow-up of
 * a consignor. The token travels in the body (it was in the fragment of the address, which never
 * reaches a server), and every failure of a link looks the same: `404 PUBLIC_LINK_NOT_FOUND`.
 * The answers of the view calls are open objects in the contract, so `utils/public-pages.ts`
 * reads them into the shapes the screens use.
 */
export function createPublicPagesApi(client: ApiClient) {
  return {
    settlement: (token: string) =>
      client.request<unknown>('/v1/public/settlement', {
        method: 'POST',
        body: { token },
        anonymous: true,
      }),
    /** CPF, address and the consent (with the version of the term that was read). */
    submitBuyerData: (token: string, data: Omit<BuyerSubmission, 'token'>) =>
      client.request<{ result: 'OK' }>('/v1/public/settlement/data', {
        method: 'POST',
        body: { token, ...data },
        anonymous: true,
      }),
    /** "I already paid": it only warns the store, it never marks the settlement as paid. */
    claimPaid: (token: string) =>
      client.request<{ result: 'OK' | 'ALREADY_PAID' }>('/v1/public/settlement/paid', {
        method: 'POST',
        body: { token },
        anonymous: true,
      }),
    /**
     * The receipt of the payment, an image sent as it is. The token goes in the header (the body
     * is the file). `RECEIPT_EXISTS` says the buyer already sent one.
     */
    sendReceipt: (token: string, file: Blob) =>
      client.request<{ result: 'OK' | 'ALREADY_PAID' | 'RECEIPT_EXISTS' }>(
        '/v1/public/settlement/receipt',
        { method: 'PUT', body: file, headers: { 'x-public-token': token }, anonymous: true },
      ),
    /** The live auctions of the stores that chose to appear (no session, no token). */
    showcase: (filters: ShowcaseFilters, offset: number, signal?: AbortSignal) =>
      client.request<unknown>('/v1/public/showcase', {
        query: { ...filters, limit: SHOWCASE_PAGE, offset },
        signal,
        anonymous: true,
      }),
    /** The consignor opens the page with the token and the 4 first digits of their CPF. */
    consignor: (token: string, key: string) =>
      client.request<unknown>('/v1/public/consignor', {
        method: 'POST',
        body: { token, key },
        anonymous: true,
      }),
  };
}

export type PublicPagesApi = ReturnType<typeof createPublicPagesApi>;
