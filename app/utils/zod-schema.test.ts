import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toFormSchema } from './zod-schema';

const schema = toFormSchema(
  z.object({
    email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')),
  }),
);

describe('toFormSchema', () => {
  it('returns the parsed value, with the e-mail trimmed', async () => {
    const result = await schema.parse({ email: '  igor@example.com ' });
    expect(result).toEqual({ value: { email: 'igor@example.com' }, errors: [] });
  });

  it('groups the messages by field path', async () => {
    const result = await schema.parse({ email: 'not-an-email' });
    expect(result.value).toBeUndefined();
    expect(result.errors).toEqual([{ path: 'email', errors: ['validation.email'] }]);
  });

  it('reports a required field', async () => {
    const result = await schema.parse({ email: '' });
    expect(result.errors[0]).toMatchObject({ path: 'email', errors: ['validation.required'] });
  });
});
