import { ApiError } from '../api/errors';

type Translate = (key: string) => string;
type Exists = (key: string) => boolean;

/**
 * Picks the translation key for an error. API errors are translated by their
 * stable `code`; the `detail` sent by the API is never shown.
 */
export function errorMessageKey(error: unknown, exists: Exists): string {
  if (!(error instanceof ApiError)) return 'errors.unknown';
  if (error.kind !== 'http') return `errors.${error.kind}`;
  if (error.code && exists(`errors.${error.code}`)) return `errors.${error.code}`;
  return 'errors.http';
}

export function translateError(error: unknown, t: Translate, exists: Exists): string {
  return t(errorMessageKey(error, exists));
}
