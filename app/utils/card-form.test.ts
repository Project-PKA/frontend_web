import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  cardFormSchema,
  checkPhotos,
  consignorLinkUrl,
  settlementLinkUrl,
  parseCommission,
  toCreateBody,
  whatsappUrl,
} from './card-form';

const file = (name: string, type = 'image/png', size = 100) => {
  const item = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(item, 'size', { value: size });
  return item;
};

const OWN = {
  language: 'PT',
  condition: 'NM',
  isFoil: false,
  notes: '',
  origin: 'OWN',
  consignorId: '',
  commission: '',
};

describe('checkPhotos', () => {
  it('accepts JPEG, PNG and WebP', () => {
    const result = checkPhotos(0, [
      file('a.jpg', 'image/jpeg'),
      file('b.png'),
      file('c.webp', 'image/webp'),
    ]);
    expect(result.accepted).toHaveLength(3);
    expect(result.rejected).toEqual([]);
  });

  it('leaves out a file of another type or a too big one, and says why', () => {
    const result = checkPhotos(0, [
      file('doc.pdf', 'application/pdf'),
      file('big.png', 'image/png', MAX_PHOTO_BYTES + 1),
      file('ok.png', 'image/png', MAX_PHOTO_BYTES),
    ]);
    expect(result.accepted.map((item) => item.name)).toEqual(['ok.png']);
    expect(result.rejected).toEqual([
      { name: 'doc.pdf', reason: 'type' },
      { name: 'big.png', reason: 'size' },
    ]);
  });

  it('stops at 8 photos, counting those already chosen', () => {
    const result = checkPhotos(MAX_PHOTOS - 1, [file('a.png'), file('b.png')]);
    expect(result.accepted.map((item) => item.name)).toEqual(['a.png']);
    expect(result.rejected).toEqual([{ name: 'b.png', reason: 'limit' }]);
  });
});

describe('parseCommission', () => {
  it.each([
    ['15', 15],
    ['12.5', 12.5],
    ['12,5', 12.5],
    [' 0 ', 0],
    ['100', 100],
  ])('reads %s', (text, value) => {
    expect(parseCommission(text)).toBe(value);
  });

  it.each(['', 'abc', '101', '-1', '1e2', '12.5.1', '--'])('refuses %s', (text) => {
    expect(parseCommission(text)).toBeNull();
  });
});

describe('cardFormSchema', () => {
  const issues = (form: object) => {
    const result = cardFormSchema.safeParse(form);
    return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
  };

  it('accepts an own card without a consignor', () => {
    expect(issues(OWN)).toEqual([]);
  });

  it('does not pick the origin for the person', () => {
    expect(issues({ ...OWN, origin: '' })).toEqual(['origin:validation.required']);
  });

  it('wants the consignor and the commission for a consigned card', () => {
    expect(issues({ ...OWN, origin: 'CONSIGNED' })).toEqual([
      'consignorId:validation.required',
      'commission:validation.required',
    ]);
    expect(issues({ ...OWN, origin: 'CONSIGNED', consignorId: 'u1', commission: '150' })).toEqual([
      'commission:validation.commission',
    ]);
    expect(issues({ ...OWN, origin: 'CONSIGNED', consignorId: 'u1', commission: '15' })).toEqual(
      [],
    );
  });

  it('limits the notes and wants a language and a condition', () => {
    expect(issues({ ...OWN, notes: 'x'.repeat(2001) })).toEqual(['notes:validation.tooLong']);
    expect(issues({ ...OWN, language: '', condition: '' })).toEqual([
      'language:validation.required',
      'condition:validation.required',
    ]);
  });
});

describe('toCreateBody', () => {
  it('leaves out the notes and the consignor of an own card', () => {
    expect(toCreateBody('swsh4-044', OWN as never)).toEqual({
      tcgdex_id: 'swsh4-044',
      language: 'PT',
      condition: 'NM',
      is_foil: false,
      origin: 'OWN',
    });
  });

  it('sends the trimmed notes, the consignor and the commission of a consigned card', () => {
    expect(
      toCreateBody('swsh4-044', {
        ...OWN,
        notes: '  light mark ',
        isFoil: true,
        origin: 'CONSIGNED',
        consignorId: 'u1',
        commission: '12,5',
      } as never),
    ).toEqual({
      tcgdex_id: 'swsh4-044',
      language: 'PT',
      condition: 'NM',
      is_foil: true,
      origin: 'CONSIGNED',
      notes: 'light mark',
      consignor_id: 'u1',
      commission_pct: 12.5,
    });
  });
});

describe('links', () => {
  it('puts the token in the fragment, never in the path or the query', () => {
    const url = consignorLinkUrl('https://app.example.com', 'a b/c');
    expect(url).toBe('https://app.example.com/consignor#token=a%20b%2Fc');
    expect(new URL(url).search).toBe('');
  });

  it('puts the token of a settlement in the fragment too', () => {
    const url = settlementLinkUrl('https://app.example.com', 'a b/c');
    expect(url).toBe('https://app.example.com/settlement#token=a%20b%2Fc');
    expect(new URL(url).search).toBe('');
  });

  it('opens a WhatsApp chat with the digits of the phone and the text', () => {
    expect(whatsappUrl('+55 (11) 98877-1020', 'Hi! Follow it: https://x.test/c#token=1')).toBe(
      'https://wa.me/5511988771020?text=Hi!%20Follow%20it%3A%20https%3A%2F%2Fx.test%2Fc%23token%3D1',
    );
  });
});
