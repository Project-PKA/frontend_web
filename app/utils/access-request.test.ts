import { describe, expect, it } from 'vitest';
import { accessRequestSchema, toAccessRequestBody } from './access-request';

const valid = {
  name: 'Ana Souza',
  email: 'ana@example.com',
  whatsapp: '(11) 91234-5678',
  storeName: 'Poké Card Hub',
  message: 'Fazemos leilões toda semana.',
};

const errorsOf = (input: Record<string, unknown>) =>
  accessRequestSchema
    .safeParse(input)
    .error?.issues.map((issue) => [issue.path.join('.'), issue.message]) ?? [];

describe('accessRequestSchema', () => {
  it('accepts a complete request', () => {
    expect(accessRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a request with only what is required', () => {
    const result = accessRequestSchema.safeParse({ ...valid, whatsapp: '', message: '' });
    expect(result.success).toBe(true);
  });

  it('trims the text', () => {
    const result = accessRequestSchema.parse({
      ...valid,
      name: '  Ana  ',
      email: ' ana@example.com ',
    });
    expect(result.name).toBe('Ana');
    expect(result.email).toBe('ana@example.com');
  });

  it.each(['name', 'email', 'storeName'])('requires %s', (field) => {
    expect(errorsOf({ ...valid, [field]: '   ' })).toContainEqual([field, 'validation.required']);
  });

  it('refuses an e-mail that is not one', () => {
    expect(errorsOf({ ...valid, email: 'ana@' })).toContainEqual(['email', 'validation.email']);
  });

  it('refuses a WhatsApp number without the area code', () => {
    expect(errorsOf({ ...valid, whatsapp: '91234-5678' })).toContainEqual([
      'whatsapp',
      'validation.phone',
    ]);
  });

  it.each([
    ['name', 121],
    ['storeName', 121],
    ['message', 1001],
  ])('refuses %s longer than the API takes', (field, length) => {
    expect(errorsOf({ ...valid, [field]: 'a'.repeat(length) })).toContainEqual([
      field,
      'validation.tooLong',
    ]);
  });

  it('takes the longest values the API takes', () => {
    const edge = {
      ...valid,
      name: 'a'.repeat(120),
      storeName: 'b'.repeat(120),
      message: 'c'.repeat(1000),
    };
    expect(accessRequestSchema.safeParse(edge).success).toBe(true);
  });
});

describe('toAccessRequestBody', () => {
  it('maps the form to the fields of the API', () => {
    expect(toAccessRequestBody(valid)).toEqual({
      name: 'Ana Souza',
      email: 'ana@example.com',
      store_name: 'Poké Card Hub',
      whatsapp: '(11) 91234-5678',
      message: 'Fazemos leilões toda semana.',
      website: '',
    });
  });

  it('leaves out the optional fields that were left empty', () => {
    const body = toAccessRequestBody({ ...valid, whatsapp: '', message: '' });
    expect(body).not.toHaveProperty('whatsapp');
    expect(body).not.toHaveProperty('message');
  });

  it('always sends the decoy empty', () => {
    expect(toAccessRequestBody(valid).website).toBe('');
    expect(toAccessRequestBody({ ...valid, whatsapp: '', message: '' }).website).toBe('');
  });
});
