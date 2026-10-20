import type { paths } from './generated';
import type { ApiClient } from './client';

type JsonBody<Path extends keyof paths> = paths[Path] extends {
  get: { responses: { 200: { content: { 'application/json': infer Body } } } };
}
  ? Body
  : never;

/** `GET /v1/finance/overview`: the numbers and the charts of a period. */
export type FinanceOverview = JsonBody<'/v1/finance/overview'>;
/** `GET /v1/finance/top-buyers`: who bought the most in the period. */
export type TopBuyers = JsonBody<'/v1/finance/top-buyers'>;
/** `GET /v1/finance/consignment-payouts`: what is owed to each consignor. */
export type ConsignmentPayouts = JsonBody<'/v1/finance/consignment-payouts'>;

export type FinancePeriod = 'today' | '7' | '15' | '30';

const TOP_BUYERS = 5;

/** All of it needs `can_view_finance`; the period is the only filter of the whole app. */
export function createFinanceApi(client: ApiClient) {
  return {
    overview: (period: FinancePeriod, signal?: AbortSignal) =>
      client.request<FinanceOverview>('/v1/finance/overview', { query: { period }, signal }),
    topBuyers: (period: FinancePeriod, signal?: AbortSignal) =>
      client.request<TopBuyers>('/v1/finance/top-buyers', {
        query: { period, limit: TOP_BUYERS },
        signal,
      }),
    payouts: (period: FinancePeriod, signal?: AbortSignal) =>
      client.request<ConsignmentPayouts>('/v1/finance/consignment-payouts', {
        query: { period },
        signal,
      }),
  };
}

export type FinanceApi = ReturnType<typeof createFinanceApi>;
