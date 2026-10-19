import { translateError } from '../utils/error-message';

/** Turns an error into a translated message (see `errorMessageKey`). */
export function useErrorMessage() {
  const { t, te } = useI18n();
  return (error: unknown): string => translateError(error, t, te);
}
