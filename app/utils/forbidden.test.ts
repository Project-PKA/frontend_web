import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import { forbiddenAction } from './forbidden';

const forbidden = (code?: string) => new ApiError('http', { status: 403, code });

describe('forbiddenAction', () => {
  it.each(['MISSING_PERMISSION', 'OWNER_REQUIRED'])(
    'shows the no-permission state for %s',
    (code) => {
      expect(forbiddenAction(forbidden(code))).toBe('no-permission');
    },
  );

  it('asks for the store again on a plain 403', () => {
    expect(forbiddenAction(forbidden('FORBIDDEN'))).toBe('reselect-store');
    expect(forbiddenAction(forbidden())).toBe('reselect-store');
  });
});
