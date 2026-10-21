import { describe, expect, it } from 'vitest';
import { prefillFromRequest, toNewStore, type StoreForm } from './admin-stores';

const base: StoreForm = {
  name: ' Marina Cards ',
  city: ' São Paulo / SP ',
  plan: ' standard ',
  memberLimit: '3',
  cardLimit: '',
  owner: { mode: 'new', email: ' marina@example.com ' },
};

describe('toNewStore', () => {
  it('builds the body for a new owner, with the plan in capitals and no empty field', () => {
    expect(toNewStore(base)).toEqual({
      store: {
        name: 'Marina Cards',
        city: 'São Paulo / SP',
        plan: 'STANDARD',
        member_limit: 3,
        owner_email: 'marina@example.com',
      },
    });
  });

  it('leaves out the city, the plan and the card limit when they are empty', () => {
    expect(toNewStore({ ...base, city: ' ', plan: '', memberLimit: '' })).toEqual({
      store: { name: 'Marina Cards', member_limit: 5, owner_email: 'marina@example.com' },
    });
  });

  it('sends the card limit when it was typed', () => {
    const result = toNewStore({ ...base, cardLimit: '500' });
    expect('store' in result && result.store.card_limit).toBe(500);
  });

  it('reads the limits of a number field, which gives numbers (and 0 is not "empty")', () => {
    const form = { ...base, memberLimit: 0, cardLimit: 500 } as unknown as StoreForm;
    expect(toNewStore(form)).toEqual({ errors: { memberLimit: true } });
    const ok = toNewStore({ ...form, memberLimit: 4 } as unknown as StoreForm);
    expect('store' in ok && ok.store.member_limit).toBe(4);
    expect('store' in ok && ok.store.card_limit).toBe(500);
  });

  it('uses the account of an existing user as the owner', () => {
    const result = toNewStore({ ...base, owner: { mode: 'existing', userId: 'u-1' } });
    expect(result).toEqual({
      store: expect.objectContaining({ owner_user_id: 'u-1' }),
    });
    expect('store' in result && 'owner_email' in result.store).toBe(false);
  });

  it('turns an access request into the store', () => {
    const result = toNewStore({ ...base, accessRequestId: 'a-1' });
    expect('store' in result && result.store.access_request_id).toBe('a-1');
  });

  it('names what is wrong, as keys', () => {
    const result = toNewStore({
      name: '  ',
      city: 'x'.repeat(81),
      plan: '9bad',
      memberLimit: '0',
      cardLimit: '2000000',
      owner: { mode: 'new', email: 'nope' },
    });
    expect(result).toEqual({
      errors: {
        nameRequired: true,
        cityTooLong: true,
        planInvalid: true,
        memberLimit: true,
        cardLimit: true,
        ownerEmail: true,
      },
    });
  });

  it('asks for an owner when an existing user was not chosen', () => {
    expect(toNewStore({ ...base, owner: { mode: 'existing', userId: null } })).toEqual({
      errors: { ownerUser: true },
    });
  });

  it('refuses a name that is too long and a limit that is not a whole number', () => {
    expect(toNewStore({ ...base, name: 'x'.repeat(121) })).toEqual({
      errors: { nameTooLong: true },
    });
    expect(toNewStore({ ...base, memberLimit: '2.5' })).toEqual({ errors: { memberLimit: true } });
  });
});

describe('prefillFromRequest', () => {
  it('takes the store and the e-mail of whoever asked', () => {
    expect(prefillFromRequest({ store_name: 'Sul TCG', email: 'paulo@example.com' })).toEqual({
      name: 'Sul TCG',
      ownerEmail: 'paulo@example.com',
    });
  });
});
