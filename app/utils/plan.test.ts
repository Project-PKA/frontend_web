import { describe, expect, it } from 'vitest';
import { atLimit, toPlanChange, usageRows } from './plan';

const plan = {
  limits: { members: 5, cards: 500, groups: 3 },
  usage: { members: 3, pending_invitations: 1, cards: 120, groups: 1 },
};

describe('usageRows', () => {
  it('lists groups, members and cards with what is used and the limit', () => {
    expect(usageRows(plan)).toEqual([
      { key: 'groups', used: 1, limit: 3 },
      { key: 'members', used: 3, limit: 5 },
      { key: 'cards', used: 120, limit: 500 },
    ]);
  });

  it('treats cards without a limit as unlimited', () => {
    const rows = usageRows({ ...plan, limits: { ...plan.limits, cards: null } });
    expect(rows[2]).toEqual({ key: 'cards', used: 120, limit: null });
  });
});

describe('atLimit', () => {
  it('is true at the limit or above, never when unlimited', () => {
    expect(atLimit({ key: 'members', used: 5, limit: 5 })).toBe(true);
    expect(atLimit({ key: 'members', used: 6, limit: 5 })).toBe(true);
    expect(atLimit({ key: 'members', used: 4, limit: 5 })).toBe(false);
    expect(atLimit({ key: 'cards', used: 9999, limit: null })).toBe(false);
  });
});

describe('toPlanChange', () => {
  it('sends only what was typed, with the plan in capitals', () => {
    expect(toPlanChange(' network ', ' more groups ')).toEqual({
      change: { requested_plan: 'NETWORK', message: 'more groups' },
    });
    expect(toPlanChange('', 'only a message')).toEqual({ change: { message: 'only a message' } });
    expect(toPlanChange('STORE', '  ')).toEqual({ change: { requested_plan: 'STORE' } });
  });

  it('needs at least one of the two', () => {
    expect(toPlanChange('  ', '  ')).toEqual({ error: 'empty' });
  });

  it('refuses a code the API would refuse', () => {
    expect(toPlanChange('9STORE', '')).toEqual({ error: 'planInvalid' });
    expect(toPlanChange('A', '')).toEqual({ error: 'planInvalid' });
    expect(toPlanChange('HAS SPACE', '')).toEqual({ error: 'planInvalid' });
  });

  it('refuses a message that is too long', () => {
    expect(toPlanChange('', 'x'.repeat(1001))).toEqual({ error: 'messageTooLong' });
    expect(toPlanChange('', 'x'.repeat(1000))).toHaveProperty('change');
  });
});
