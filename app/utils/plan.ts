import type { PlanChange, PlanOverview } from '../api/plan';

/** The code of a plan: what the API accepts (`^[A-Z][A-Z0-9_]{1,19}$`). */
export const PLAN_CODE = /^[A-Z][A-Z0-9_]{1,19}$/;
export const MESSAGE_MAX = 1000;

export type UsageKey = 'groups' | 'members' | 'cards';

export interface UsageRow {
  key: UsageKey;
  used: number;
  /** `null` is no limit (only the cards can be unlimited). */
  limit: number | null;
}

/** The three limits of the design, in its order, each with what is being used. */
export function usageRows(plan: Pick<PlanOverview, 'limits' | 'usage'>): UsageRow[] {
  return [
    { key: 'groups', used: plan.usage.groups, limit: plan.limits.groups },
    { key: 'members', used: plan.usage.members, limit: plan.limits.members },
    { key: 'cards', used: plan.usage.cards, limit: plan.limits.cards ?? null },
  ];
}

/** At the limit or above: the screen says so, so the owner can ask for more before it blocks. */
export const atLimit = (row: UsageRow): boolean => row.limit !== null && row.used >= row.limit;

export type ChangeError = 'empty' | 'planInvalid' | 'messageTooLong';

/**
 * What the owner typed, as the API takes it: a field left empty is not sent. At least one of the
 * two is needed. The plan is written in capitals, so a lowercase code is fixed, not refused.
 */
export function toPlanChange(
  plan: string,
  message: string,
): { change: PlanChange } | { error: ChangeError } {
  const code = plan.trim().toUpperCase();
  const text = message.trim();
  if (code === '' && text === '') return { error: 'empty' };
  if (code !== '' && !PLAN_CODE.test(code)) return { error: 'planInvalid' };
  if (text.length > MESSAGE_MAX) return { error: 'messageTooLong' };
  const change: PlanChange = {};
  if (code !== '') change.requested_plan = code;
  if (text !== '') change.message = text;
  return { change };
}
