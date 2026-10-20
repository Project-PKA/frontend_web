import { z } from 'zod';
import type { PermissionChoice, TeamInvitation, TeamMember } from '../api/team';
import { PERMISSIONS, toPermissionMap, type Permission } from './permissions';

/** The order of the design's list: stock, auctions, settlements (customers), finance, delete. */
export const PERMISSION_ORDER: readonly Permission[] = [
  'can_manage_inventory',
  'can_manage_auctions',
  'can_manage_customers',
  'can_view_finance',
  'can_delete',
];

/** What a new employee starts with, as in the design; deleting stays blocked by default. */
export const DEFAULT_CHOICE: Record<Permission, boolean> = {
  can_manage_inventory: true,
  can_manage_auctions: true,
  can_manage_customers: true,
  can_view_finance: false,
  can_delete: false,
};

/** The five permissions as the API takes them: every key, so a switch turned off is sent too. */
export function toChoice(map: Record<Permission, boolean>): PermissionChoice {
  const choice: Record<string, boolean> = {};
  for (const permission of PERMISSIONS) choice[permission] = map[permission] === true;
  return choice as PermissionChoice;
}

/** The permissions that are on, in the order of the design. */
export function granted(raw: Record<string, boolean> | undefined): Permission[] {
  const map = toPermissionMap(raw);
  return PERMISSION_ORDER.filter((permission) => map[permission]);
}

/** The e-mail of an invitation; the message is a translation key (the page translates it). */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'team.invite.errors.emailRequired')
    .max(254, 'team.invite.errors.emailInvalid')
    .pipe(z.email('team.invite.errors.emailInvalid')),
});

export type RowStatus = 'active' | 'pending' | 'expired';

export interface TeamRow {
  /** Unique across members and invitations (`member:<id>`, `invite:<id>`). */
  key: string;
  kind: 'member' | 'invite';
  id: string;
  email: string;
  name: string | null;
  owner: boolean;
  status: RowStatus;
  permissions: Record<Permission, boolean>;
}

/**
 * The owners first, then the employees, then the invitations still open (pending or expired):
 * an accepted or revoked invitation is not an open one, and an accepted one is already a member.
 */
export function teamRows(
  members: readonly TeamMember[],
  invitations: readonly TeamInvitation[],
): TeamRow[] {
  const fromMembers = members.map<TeamRow>((member) => ({
    key: `member:${member.id}`,
    kind: 'member',
    id: member.id,
    email: member.email,
    name: member.name,
    owner: member.role === 'OWNER',
    status: 'active',
    permissions: toPermissionMap(member.permissions),
  }));
  fromMembers.sort((a, b) => Number(b.owner) - Number(a.owner));

  const open = invitations
    .filter((invitation) => invitation.state === 'PENDING' || invitation.state === 'EXPIRED')
    .map<TeamRow>((invitation) => ({
      key: `invite:${invitation.id}`,
      kind: 'invite',
      id: invitation.id,
      email: invitation.email,
      name: null,
      owner: false,
      status: invitation.state === 'EXPIRED' ? 'expired' : 'pending',
      permissions: toPermissionMap(invitation.permissions),
    }));
  return [...fromMembers, ...open];
}
