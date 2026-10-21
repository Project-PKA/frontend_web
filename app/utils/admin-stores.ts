import { z } from 'zod';
import type { AccessRequest, NewStore } from '../api/admin';
import { PLAN_CODE } from './plan';

export const MEMBER_LIMIT_DEFAULT = 5;
export const MEMBER_LIMIT_MAX = 1000;
export const CARD_LIMIT_MAX = 1_000_000;

/** A whole number from `min` to `max` written in a field; `null` when it is not one. */
function wholeNumber(value: unknown, min: number, max: number): number | null {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return number >= min && number <= max ? number : null;
}

export type StoreFormError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'cityTooLong'
  | 'planInvalid'
  | 'memberLimit'
  | 'cardLimit'
  | 'ownerEmail'
  | 'ownerUser';

export interface StoreForm {
  name: string;
  city: string;
  /** The code of the plan, or empty to leave it to the API. */
  plan: string;
  memberLimit: string;
  /** Empty is "no limit" (the API default). */
  cardLimit: string;
  owner: { mode: 'new'; email: string } | { mode: 'existing'; userId: string | null };
  accessRequestId?: string;
}

const emailSchema = z.email();

type Errors = Partial<Record<StoreFormError, true>>;

/** The texts of the form, checked: the first part of the form. */
function checkTexts(form: StoreForm, errors: Errors) {
  const name = form.name.trim();
  const plan = form.plan.trim().toUpperCase();
  if (name === '') errors.nameRequired = true;
  else if (name.length > 120) errors.nameTooLong = true;
  if (form.city.trim().length > 80) errors.cityTooLong = true;
  if (plan !== '' && !PLAN_CODE.test(plan)) errors.planInvalid = true;
}

/** The two limits: the members always (with a default), the cards only when typed. */
function checkLimits(form: StoreForm, errors: Errors) {
  // A number field gives a number (so a typed 0 is falsy), or an empty text: both are read as text.
  const memberText = String(form.memberLimit ?? '').trim();
  const cardText = String(form.cardLimit ?? '').trim();
  const memberLimit = wholeNumber(
    memberText === '' ? MEMBER_LIMIT_DEFAULT : memberText,
    1,
    MEMBER_LIMIT_MAX,
  );
  if (memberLimit === null) errors.memberLimit = true;
  const cardLimit = cardText === '' ? undefined : wholeNumber(cardText, 1, CARD_LIMIT_MAX);
  if (cardLimit === null) errors.cardLimit = true;
  return { memberLimit, cardLimit };
}

function checkOwner(form: StoreForm, errors: Errors) {
  if (form.owner.mode === 'new') {
    if (!emailSchema.safeParse(form.owner.email.trim()).success) errors.ownerEmail = true;
  } else if (!form.owner.userId) {
    errors.ownerUser = true;
  }
}

/**
 * The form as the API takes it, or the fields that are wrong (as keys, for the page to translate).
 * Empty optional fields are not sent, so the API keeps its own default.
 */
export function toNewStore(form: StoreForm): { store: NewStore } | { errors: Errors } {
  const errors: Errors = {};
  checkTexts(form, errors);
  const { memberLimit, cardLimit } = checkLimits(form, errors);
  checkOwner(form, errors);
  if (Object.keys(errors).length > 0 || memberLimit === null || cardLimit === null) {
    return { errors };
  }

  const city = form.city.trim();
  const plan = form.plan.trim().toUpperCase();
  const store: NewStore = { name: form.name.trim(), member_limit: memberLimit };
  if (city !== '') store.city = city;
  if (plan !== '') store.plan = plan;
  if (cardLimit !== undefined) store.card_limit = cardLimit;
  if (form.owner.mode === 'new') store.owner_email = form.owner.email.trim();
  else store.owner_user_id = form.owner.userId ?? undefined;
  if (form.accessRequestId) store.access_request_id = form.accessRequestId;
  return { store };
}

/** What an access request already tells: the store to create and who asked for it. */
export function prefillFromRequest(request: Pick<AccessRequest, 'store_name' | 'email'>) {
  return { name: request.store_name, ownerEmail: request.email };
}
