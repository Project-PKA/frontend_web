import { describe, expect, it } from 'vitest';
import { fieldIds } from './field-ids';

describe('fieldIds', () => {
  it('generates the id of the control when none is given', () => {
    const ids = fieldIds({ generated: 'v-1' });
    expect(ids.control).toBe('field-v-1');
    expect(ids.hint).toBe('field-v-1-hint');
    expect(ids.error).toBe('field-v-1-error');
  });

  it('uses the id it is given', () => {
    expect(fieldIds({ id: 'name', generated: 'v-1' }).error).toBe('name-error');
  });

  it('does not describe a control that has no hint and no error', () => {
    expect(fieldIds({ generated: 'v-1' }).describedby).toBeUndefined();
    expect(fieldIds({ generated: 'v-1', error: null }).describedby).toBeUndefined();
  });

  it('describes the control by the hint, the error, or both in that order', () => {
    expect(fieldIds({ id: 'a', generated: 'x', hint: 'h' }).describedby).toBe('a-hint');
    expect(fieldIds({ id: 'a', generated: 'x', error: 'e' }).describedby).toBe('a-error');
    expect(fieldIds({ id: 'a', generated: 'x', hint: 'h', error: 'e' }).describedby).toBe(
      'a-hint a-error',
    );
  });
});
