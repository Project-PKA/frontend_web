import {
  CARD_ORIGINS,
  CARD_STATUSES,
  type CardDetail,
  type CardFilters,
  type CardStatus,
} from '../api/inventory';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'dashed' | undefined;

function first(value: unknown): string | undefined {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' && one.trim() !== '' ? one.trim() : undefined;
}

/** The filters of the address (`?status=SOLD`), keeping only values the API knows. */
export function parseFilters(query: Record<string, unknown>): CardFilters {
  const filters: CardFilters = {};
  const q = first(query.q);
  const status = first(query.status);
  const origin = first(query.origin);
  if (q) filters.q = q.slice(0, 100);
  if (status && (CARD_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as CardFilters['status'];
  }
  if (origin && (CARD_ORIGINS as readonly string[]).includes(origin)) {
    filters.origin = origin as CardFilters['origin'];
  }
  return filters;
}

/** The address for some filters: only what is set, so a clean list has a clean address. */
export function filtersToQuery(filters: CardFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.status) query.status = filters.status;
  if (filters.origin) query.origin = filters.origin;
  return query;
}

export function hasFilters(filters: CardFilters): boolean {
  return Object.keys(filtersToQuery(filters)).length > 0;
}

/** "Charizard ex 199/165": the name and the number as the design writes them. */
export function cardTitle(catalog: { name: string; number: string }): string {
  return `${catalog.name} ${catalog.number}`.trim();
}

export function statusTone(status: CardStatus): Tone {
  const tones: Record<CardStatus, Tone> = {
    AVAILABLE: undefined,
    SCHEDULED: 'info',
    AWAITING_CONFIRMATION: 'warning',
    SOLD: 'success',
  };
  return tones[status];
}

export type AuctionResult =
  'scheduled' | 'active' | 'awaitingValidation' | 'sold' | 'noWinner' | 'cancelled';

/** What to say about an auction of the card, from its status and whether it had a winner. */
export function auctionResult(auction: CardDetail['auctions'][number]): AuctionResult {
  switch (auction.status) {
    case 'ACTIVE':
      return 'active';
    case 'PAUSED_FOR_VALIDATION':
      return 'awaitingValidation';
    case 'CANCELLED':
      return 'cancelled';
    case 'FINISHED':
      return auction.winning_amount === null ? 'noWinner' : 'sold';
    default:
      return 'scheduled';
  }
}

export function resultTone(result: AuctionResult): Tone {
  const tones: Record<AuctionResult, Tone> = {
    scheduled: 'info',
    active: 'success',
    awaitingValidation: 'warning',
    sold: 'success',
    noWinner: undefined,
    cancelled: 'danger',
  };
  return tones[result];
}
