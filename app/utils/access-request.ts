import { z } from 'zod';
import { isBrazilPhone } from './phone';

/** The form of "Request access". Messages are translation keys. */
export const accessRequestSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120, 'validation.tooLong'),
  email: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(254, 'validation.tooLong')
    .pipe(z.email('validation.email')),
  whatsapp: z
    .string()
    .trim()
    .refine((value) => value === '' || isBrazilPhone(value), 'validation.phone'),
  storeName: z.string().trim().min(1, 'validation.required').max(120, 'validation.tooLong'),
  message: z.string().trim().max(1000, 'validation.tooLong'),
});

export type AccessRequestForm = z.output<typeof accessRequestSchema>;

/**
 * The body for `POST /v1/public/access-requests`. Optional fields that were left empty are
 * left out. `website` is the decoy of the API: a person never fills it, so it always goes empty.
 */
export function toAccessRequestBody(form: AccessRequestForm) {
  return {
    name: form.name,
    email: form.email,
    store_name: form.storeName,
    ...(form.whatsapp ? { whatsapp: form.whatsapp } : {}),
    ...(form.message ? { message: form.message } : {}),
    website: '',
  };
}
