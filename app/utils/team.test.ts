import { describe, expect, it } from 'vitest';
import type { TeamInvitation, TeamMember } from '../api/team';
import { DEFAULT_CHOICE, granted, inviteSchema, teamRows, toChoice } from './team';

const member = (id: string, role: 'OWNER' | 'STAFF', permissions: Record<string, boolean> = {}) =>
  ({
    id,
    user_id: `user-${id}`,
    email: `${id}@example.com`,
    name: null,
    role,
    permissions,
    created_at: '2030-03-01T12:00:00.000Z',
  }) as TeamMember;

const invitation = (id: string, state: TeamInvitation['state']) =>
  ({
    id,
    email: `${id}@example.com`,
    role: 'STAFF',
    permissions: { can_manage_inventory: true },
    state,
    expires_at: '2030-03-08T12:00:00.000Z',
    created_at: '2030-03-01T12:00:00.000Z',
  }) as TeamInvitation;

describe('defaults and choice', () => {
  it('starts an employee with stock, auctions and customers, and deleting blocked', () => {
    expect(DEFAULT_CHOICE).toEqual({
      can_manage_inventory: true,
      can_manage_auctions: true,
      can_manage_customers: true,
      can_view_finance: false,
      can_delete: false,
    });
  });

  it('sends every permission, including the ones turned off', () => {
    expect(toChoice({ ...DEFAULT_CHOICE, can_manage_auctions: false })).toEqual({
      can_manage_inventory: true,
      can_manage_auctions: false,
      can_manage_customers: true,
      can_view_finance: false,
      can_delete: false,
    });
  });

  it('lists what is on, in the order of the design, ignoring unknown keys', () => {
    expect(
      granted({
        can_delete: true,
        can_manage_inventory: true,
        can_view_finance: true,
        other: true,
      }),
    ).toEqual(['can_manage_inventory', 'can_view_finance', 'can_delete']);
    expect(granted(undefined)).toEqual([]);
  });
});

describe('inviteSchema', () => {
  it('accepts an e-mail, trimmed', () => {
    expect(inviteSchema.safeParse({ email: '  ana@example.com ' }).data).toEqual({
      email: 'ana@example.com',
    });
  });

  it('asks for the e-mail and rejects a malformed one, with a translation key', () => {
    const empty = inviteSchema.safeParse({ email: '  ' });
    expect(empty.error?.issues[0]?.message).toBe('team.invite.errors.emailRequired');
    const bad = inviteSchema.safeParse({ email: 'ana@' });
    expect(bad.error?.issues[0]?.message).toBe('team.invite.errors.emailInvalid');
  });
});

describe('teamRows', () => {
  it('puts the owner first, then the employees, then the open invitations', () => {
    const rows = teamRows(
      [member('ana', 'STAFF'), member('igor', 'OWNER')],
      [invitation('leo', 'PENDING'), invitation('bia', 'EXPIRED')],
    );
    expect(rows.map((row) => row.key)).toEqual([
      'member:igor',
      'member:ana',
      'invite:leo',
      'invite:bia',
    ]);
    expect(rows.map((row) => row.status)).toEqual(['active', 'active', 'pending', 'expired']);
    expect(rows[0]).toMatchObject({ owner: true, kind: 'member' });
  });

  it('leaves out the invitations that are not open any more', () => {
    const rows = teamRows([], [invitation('a', 'ACCEPTED'), invitation('b', 'REVOKED')]);
    expect(rows).toEqual([]);
  });

  it('keeps only the permissions the app knows', () => {
    const [row] = teamRows([member('ana', 'STAFF', { can_view_finance: true, extra: true })], []);
    expect(row?.permissions.can_view_finance).toBe(true);
    expect(row?.permissions.can_delete).toBe(false);
    expect(Object.keys(row!.permissions)).toHaveLength(5);
  });
});
