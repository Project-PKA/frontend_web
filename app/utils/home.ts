import type { HomeDashboard, HomeSetup } from '../api/dashboard';

export type SetupStepId = 'store' | 'whatsapp' | 'card' | 'auction';

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
  /** The step cannot be done yet (an auction needs a card first). */
  blocked: boolean;
}

/** The checklist of a new store, in the order of the design. */
export function setupSteps(setup: HomeSetup): SetupStep[] {
  return [
    { id: 'store', done: setup.store_created, blocked: false },
    { id: 'whatsapp', done: setup.whatsapp_connected, blocked: false },
    { id: 'card', done: setup.first_card, blocked: false },
    { id: 'auction', done: setup.first_auction, blocked: !setup.first_card },
  ];
}

export function setupDone(setup: HomeSetup): number {
  return setupSteps(setup).filter((step) => step.done).length;
}

/** The welcome checklist shows until the four steps are done. */
export function setupComplete(setup: HomeSetup): boolean {
  return setupSteps(setup).every((step) => step.done);
}

// The contract does not mark the fields inside the lists as required, so they arrive typed as
// possibly missing. A row without its id cannot be keyed or linked and is left out; a missing
// text falls back to an empty one instead of breaking the whole page.
export interface CardRow {
  id: string;
  shortCode: string;
  name: string;
}

export interface SettlementRow {
  id: string;
  customerId: string | null;
  customerName: string;
  items: number;
  totalAmount: string | null;
  createdAt: string | null;
}

export function cardRows(list: HomeDashboard['cards_without_auction']): CardRow[] {
  return list.flatMap((card) =>
    card.id ? [{ id: card.id, shortCode: card.short_code ?? '', name: card.name ?? '' }] : [],
  );
}

export function settlementRows(list: HomeDashboard['quick_settlements']): SettlementRow[] {
  return list.flatMap((item) =>
    item.id
      ? [
          {
            id: item.id,
            customerId: item.customer?.id ?? null,
            customerName: item.customer?.name ?? '',
            items: item.items ?? 0,
            totalAmount: item.total_amount ?? null,
            createdAt: item.created_at ?? null,
          },
        ]
      : [],
  );
}

/** "#0412 Charizard ex" for each poll auction that waits for validation. */
export function pollLabels(alerts: HomeDashboard['poll_alerts']): string[] {
  return alerts.map((alert) => `#${alert.card.short_code ?? ''} ${alert.card.name ?? ''}`.trim());
}
