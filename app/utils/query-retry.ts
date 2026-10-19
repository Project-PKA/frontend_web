import { ApiError } from '../api/errors';

const MAX_RETRIES = 2;

/**
 * Whether a failed query is tried again. A rejection by the API (4xx) will not
 * change by asking again, so it is not retried; a network failure, a timeout and a
 * server error (5xx) are, up to twice. Reads only: writes are never retried.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError) {
    if (error.kind === 'aborted' || error.kind === 'parse') return false;
    if (error.kind === 'http') return error.status === null || error.status >= 500;
  }
  return true;
}
