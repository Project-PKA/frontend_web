import {
  SHIPMENT_STATUSES,
  type Shipment,
  type ShipmentChanges,
  type ShipmentStatus,
} from '../api/shipments';
import { whatsappUrl } from './card-form';

/** The status filter of the address (`?status=SHIPPED`), keeping only values the API knows. */
export function parseShipmentStatus(query: Record<string, unknown>): ShipmentStatus | undefined {
  const raw = Array.isArray(query.status) ? query.status[0] : query.status;
  return typeof raw === 'string' && (SHIPMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as ShipmentStatus)
    : undefined;
}

/** "São Paulo / SP", or only what is known; empty when the buyer has no address yet. */
export function destination(address: Shipment['recipient']['address'] | undefined): string {
  const city = address?.city?.trim() ?? '';
  const state = address?.state?.trim() ?? '';
  return [city, state].filter(Boolean).join(' / ');
}

/** The change that marks a shipment as sent: the code goes along only when it was typed. */
export function toShippedChanges(trackingCode: string): ShipmentChanges {
  const code = trackingCode.trim();
  return code ? { status: 'SHIPPED', tracking_code: code } : { status: 'SHIPPED' };
}

/** `wa.me` link to warn the buyer: the API sends nothing, the store does (ADR 0006). */
export function notifyUrl(phone: string, message: string): string {
  return whatsappUrl(phone, message);
}
