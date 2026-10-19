/**
 * The API sends codes and ids, never text (the text is ours, in both languages). These are the
 * codes it sends today; one it does not know falls back to a generic text instead of a blank.
 */
export const NOTIFICATION_KINDS = ['POLL_CEILING_REACHED', 'BUYER_DATA_SUBMITTED'] as const;

export const ACTIVITY_ACTIONS = [
  'auction.cancelled',
  'auction.created',
  'auction.updated',
  'bid.registered',
  'card.created',
  'card.deleted',
  'card.photo_added',
  'card.photo_removed',
  'card.updated',
  'customer.created',
  'customer.updated',
  'invitation.revoked',
  'invitation.sent',
  'member.joined',
  'member.permissions_updated',
  'member.removed',
  'message_template.reset',
  'message_template.updated',
  'ownership.transferred',
  'plan.change_requested',
  'plan.changed',
  'public_link.created',
  'public_link.revoked',
  'settlement.created',
  'settlement.deleted',
  'settlement.paid',
  'store.created',
  'store.updated',
] as const;

export const ACTIVITY_TARGETS = [
  'auction',
  'card',
  'customer',
  'invitation',
  'member',
  'message_template',
  'plan_request',
  'public_link',
  'settlement',
  'store',
] as const;

function known<Code extends string>(list: readonly Code[], value: string): value is Code {
  return (list as readonly string[]).includes(value);
}

/** Translation key of a notification's text. */
export function notificationTextKey(kind: string): string {
  return known(NOTIFICATION_KINDS, kind)
    ? `activity.notifications.kinds.${kind}`
    : 'activity.notifications.unknownKind';
}

/** Translation key of an action of the log (`card.deleted`). */
export function actionTextKey(action: string): string {
  return known(ACTIVITY_ACTIONS, action)
    ? `activity.log.actions.${action}`
    : 'activity.log.unknownAction';
}

/** Translation key of the kind of thing an entry is about, or `null` when there is none. */
export function targetTextKey(type: string | null | undefined): string | null {
  if (!type) return null;
  return known(ACTIVITY_TARGETS, type)
    ? `activity.log.targets.${type}`
    : 'activity.log.unknownTarget';
}

/** Deleting, removing and revoking stand out in the log, as the design does for "Deleted". */
export function isDestructive(action: string): boolean {
  return /\.(deleted|removed|revoked)$/.test(action);
}

/** The first characters of an id, enough to tell two entries apart. */
export function shortId(id: string | null | undefined): string | null {
  return id ? id.slice(0, 8) : null;
}

export interface Author {
  name: string | null;
  email: string;
}

/**
 * Who did it, from the team: the name when there is one, otherwise the e-mail. `null` when the
 * author is not (or no longer) on the team, or when the system itself did it.
 */
export function authorLabel(
  actorId: string | null,
  team: ReadonlyMap<string, Author>,
): string | null {
  if (actorId === null) return null;
  const member = team.get(actorId);
  if (!member) return null;
  return member.name?.trim() || member.email;
}
