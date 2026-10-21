import { z } from 'zod';
import type { CreateCard } from '../api/inventory';

export const CARD_LANGUAGES = ['PT', 'EN', 'JP', 'ES'] as const;
export const CARD_CONDITIONS = ['MINT', 'NM', 'SP', 'MP', 'HP', 'DMG'] as const;

/** What the API accepts for the real photos of a card. */
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type PhotoProblem = 'type' | 'size' | 'limit';

export interface PhotoCheck {
  accepted: File[];
  rejected: { name: string; reason: PhotoProblem }[];
}

/**
 * Which of the files the person picked can be sent: only JPEG, PNG or WebP, up to 5 MB each and 8
 * in all (counting those already chosen). The API checks the real type again; this only saves
 * a round trip and says why a file was left out.
 */
export function checkPhotos(already: number, incoming: readonly File[]): PhotoCheck {
  const result: PhotoCheck = { accepted: [], rejected: [] };
  for (const file of incoming) {
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      result.rejected.push({ name: file.name, reason: 'type' });
    } else if (file.size > MAX_PHOTO_BYTES) {
      result.rejected.push({ name: file.name, reason: 'size' });
    } else if (already + result.accepted.length >= MAX_PHOTOS) {
      result.rejected.push({ name: file.name, reason: 'limit' });
    } else {
      result.accepted.push(file);
    }
  }
  return result;
}

/** A commission typed by a person: "15", "12.5" or "12,5". `null` when it is not a number from 0 to 100. */
export function parseCommission(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value >= 0 && value <= 100 ? value : null;
}

/** The fields of the form. Messages are translation keys; the origin has no default. */
export const cardFormSchema = z
  .object({
    language: z.enum(CARD_LANGUAGES, { error: 'validation.required' }),
    condition: z.enum(CARD_CONDITIONS, { error: 'validation.required' }),
    isFoil: z.boolean(),
    notes: z.string().max(2000, 'validation.tooLong'),
    origin: z.enum(['OWN', 'CONSIGNED'], { error: 'validation.required' }),
    consignorId: z.string(),
    commission: z.string(),
  })
  .superRefine((form, context) => {
    if (form.origin !== 'CONSIGNED') return;
    if (form.consignorId === '') {
      context.addIssue({ code: 'custom', path: ['consignorId'], message: 'validation.required' });
    }
    if (parseCommission(form.commission) === null) {
      context.addIssue({
        code: 'custom',
        path: ['commission'],
        message: form.commission.trim() === '' ? 'validation.required' : 'validation.commission',
      });
    }
  });

export type CardForm = z.output<typeof cardFormSchema>;

/** The body of `POST /v1/cards`: the notes and the consignor only when there is something to say. */
export function toCreateBody(catalogId: string, form: CardForm): CreateCard {
  const consigned = form.origin === 'CONSIGNED';
  const notes = form.notes.trim();
  return {
    tcgdex_id: catalogId,
    language: form.language,
    condition: form.condition,
    is_foil: form.isFoil,
    origin: form.origin,
    ...(notes ? { notes } : {}),
    ...(consigned
      ? { consignor_id: form.consignorId, commission_pct: parseCommission(form.commission) }
      : {}),
  };
}

/** The tracking page of the consignor: the token goes in the fragment, never in the path or the query. */
export function consignorLinkUrl(siteOrigin: string, token: string): string {
  return `${siteOrigin}/consignor#token=${encodeURIComponent(token)}`;
}

/** The settlement page of a buyer: the token goes in the fragment, never in the path or the query. */
export function settlementLinkUrl(siteOrigin: string, token: string): string {
  return `${siteOrigin}/settlement#token=${encodeURIComponent(token)}`;
}

/** A WhatsApp chat with the number (digits with the country code, as the API keeps it) and the text ready. */
export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
