import type { paths } from './generated';
import type { ApiClient } from './client';

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
