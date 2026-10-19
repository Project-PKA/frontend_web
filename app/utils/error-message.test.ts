import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import { errorMessageKey, translateError } from './error-message';

const known = new Set(['errors.INVALID_CODE']);
const exists = (key: string) => known.has(key);

describe('errorMessageKey', () => {
  it('uses the key of the API error code when it has a translation', () => {
    const error = new ApiError('http', { status: 401, code: 'INVALID_CODE' });
    expect(errorMessageKey(error, exists)).toBe('errors.INVALID_CODE');
  });

  it('falls back to the generic HTTP message for a code without translation', () => {
    const error = new ApiError('http', { status: 409, code: 'SOMETHING_NEW' });
    expect(errorMessageKey(error, exists)).toBe('errors.http');
  });

  it('falls back to the generic HTTP message when there is no code', () => {
    expect(errorMessageKey(new ApiError('http', { status: 502 }), exists)).toBe('errors.http');
  });

  it.each(['network', 'timeout', 'aborted', 'parse'] as const)('maps the %s kind', (kind) => {
    expect(errorMessageKey(new ApiError(kind), exists)).toBe(`errors.${kind}`);
  });

  it('treats anything else as unknown', () => {
    expect(errorMessageKey(new Error('boom'), exists)).toBe('errors.unknown');
  });
});

describe('translateError', () => {
  it('translates by the key, never by the detail sent by the API', () => {
    const error = new ApiError('http', { status: 401, code: 'INVALID_CODE' });
    expect(translateError(error, (key) => `<${key}>`, exists)).toBe('<errors.INVALID_CODE>');
  });
});
