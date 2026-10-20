import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/shipments`: the shipping queue of the paid sales. */
export type ShipmentPage =
  paths['/v1/shipments']['get']['responses'][200]['content']['application/json'];
export type Shipment = ShipmentPage['items'][number];
export type ShipmentStatus = Shipment['status'];
export const SHIPMENT_STATUSES = [
  'TO_SHIP',
  'SHIPPED',
  'DELIVERED',
] as const satisfies readonly ShipmentStatus[];

/** What `PATCH /v1/shipments/{id}` takes. The API sends no message to anyone (ADR 0006). */
export interface ShipmentChanges {
  status?: ShipmentStatus;
  tracking_code?: string | null;
}

const PAGE_SIZE = 20;

export function createShipmentsApi(client: ApiClient) {
  return {
    list: (status: ShipmentStatus | undefined, cursor?: string, signal?: AbortSignal) =>
      client.request<ShipmentPage>('/v1/shipments', {
        query: { status, cursor, limit: PAGE_SIZE },
        signal,
      }),
    update: (id: string, changes: ShipmentChanges) =>
      client.request<Shipment>(`/v1/shipments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: changes,
      }),
  };
}

export type ShipmentsApi = ReturnType<typeof createShipmentsApi>;
