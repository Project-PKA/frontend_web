import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import ptBR from '../../i18n/locales/pt-BR.json';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_TARGETS,
  NOTIFICATION_KINDS,
  actionTextKey,
  authorLabel,
  isDestructive,
  notificationTextKey,
  shortId,
  targetTextKey,
} from './activity';

function lookup(messages: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      messages,
    );
}

describe('texts of the codes the API sends', () => {
  const keys = [
    ...NOTIFICATION_KINDS.map(notificationTextKey),
    ...ACTIVITY_ACTIONS.map(actionTextKey),
    ...ACTIVITY_TARGETS.map((type) => targetTextKey(type) as string),
    'activity.notifications.unknownKind',
    'activity.log.unknownAction',
    'activity.log.unknownTarget',
  ];

  it.each([
    ['en', en],
    ['pt-BR', ptBR],
  ])('has every text in %s', (_language, messages) => {
    const missing = keys.filter((key) => typeof lookup(messages, key) !== 'string');
    expect(missing).toEqual([]);
  });
});

describe('codes', () => {
  it('maps a known code to its key and an unknown one to the generic key', () => {
    expect(notificationTextKey('POLL_CEILING_REACHED')).toBe(
      'activity.notifications.kinds.POLL_CEILING_REACHED',
    );
    expect(notificationTextKey('SOMETHING_NEW')).toBe('activity.notifications.unknownKind');
    expect(actionTextKey('card.deleted')).toBe('activity.log.actions.card.deleted');
    expect(actionTextKey('thing.happened')).toBe('activity.log.unknownAction');
    expect(targetTextKey('card')).toBe('activity.log.targets.card');
    expect(targetTextKey('widget')).toBe('activity.log.unknownTarget');
    expect(targetTextKey(null)).toBeNull();
  });

  it('highlights only what removes something', () => {
    expect(isDestructive('card.deleted')).toBe(true);
    expect(isDestructive('member.removed')).toBe(true);
    expect(isDestructive('public_link.revoked')).toBe(true);
    expect(isDestructive('card.created')).toBe(false);
    expect(isDestructive('card.photo_removed')).toBe(false);
  });

  it('shortens an id', () => {
    expect(shortId('7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10')).toBe('7d1f6c39');
    expect(shortId(null)).toBeNull();
  });
});

describe('authorLabel', () => {
  const team = new Map([
    ['u1', { name: 'Ana Souza', email: 'ana@example.com' }],
    ['u2', { name: null, email: 'igor@example.com' }],
    ['u3', { name: '   ', email: 'zé@example.com' }],
  ]);

  it('prefers the name, then the e-mail', () => {
    expect(authorLabel('u1', team)).toBe('Ana Souza');
    expect(authorLabel('u2', team)).toBe('igor@example.com');
    expect(authorLabel('u3', team)).toBe('zé@example.com');
  });

  it('is null for the system and for someone who left the team', () => {
    expect(authorLabel(null, team)).toBeNull();
    expect(authorLabel('gone', team)).toBeNull();
  });
});
