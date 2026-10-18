import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import { shouldRetry } from './query-retry';

describe('shouldRetry', () => {
  it.each(['network', 'timeout'] as const)('retries a %s failure', (kind) => {
    expect(shouldRetry(0, new ApiError(kind))).toBe(true);
    expect(shouldRetry(1, new ApiError(kind))).toBe(true);
  });

  it('retries a server error', () => {
    expect(shouldRetry(0, new ApiError('http', { status: 503 }))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422, 429])('does not retry a %s from the API', (status) => {
    expect(shouldRetry(0, new ApiError('http', { status }))).toBe(false);
  });

  it('does not retry a cancelled request or an answer it cannot read', () => {
    expect(shouldRetry(0, new ApiError('aborted'))).toBe(false);
    expect(shouldRetry(0, new ApiError('parse'))).toBe(false);
  });

  it('gives up after two retries', () => {
    expect(shouldRetry(2, new ApiError('network'))).toBe(false);
  });

  it('retries an error it does not know, within the limit', () => {
    expect(shouldRetry(0, new Error('boom'))).toBe(true);
  });
});
