import { describe, expect, it } from 'vitest';
import { hiddenIdsFromBlockList, usernamesForHiddenUsers, visibleChatMessages } from '../lib/moderation';

describe('moderation helpers', () => {
  it('prefers mutual hidden ids', () => {
    expect(hiddenIdsFromBlockList({ blockedIds: ['a'], hiddenUserIds: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('uses outgoing block ids when hiddenUserIds is absent', () => {
    expect(hiddenIdsFromBlockList({ blockedIds: ['a'] })).toEqual(['a']);
  });

  it('hides blocked authors and keeps the viewer’s own messages', () => {
    const messages = [
      { id: '1', userId: 'me', content: 'ben' },
      { id: '2', userId: 'bad', content: 'gizle' },
      { id: '3', userId: 'ok', content: 'kal' },
    ];
    expect(visibleChatMessages(messages, new Set(['bad']), 'me').map((m) => m.id)).toEqual(['1', '3']);
  });

  it('maps hidden user ids to live identities', () => {
    const names = usernamesForHiddenUsers({ ada: 'u1', bad: 'u2' }, new Set(['u2']));
    expect(names).toEqual(new Set(['bad']));
  });
});
