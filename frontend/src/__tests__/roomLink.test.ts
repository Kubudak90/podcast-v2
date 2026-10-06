import { describe, it, expect, beforeEach } from 'vitest';
import { consumePendingRoom, parseRoomSlug, rememberPendingRoom } from '../lib/roomLink';

describe('parseRoomSlug', () => {
  it('accepts a bare room code', () => {
    expect(parseRoomSlug('Ab3_xY-1')).toBe('Ab3_xY-1');
    expect(parseRoomSlug('  @abcd  ')).toBe('abcd');
    expect(parseRoomSlug('abcd.')).toBe('abcd');
  });

  it('pulls the slug out of a room link or invite', () => {
    expect(parseRoomSlug('https://livepodchat.com/room/Ab3_xY-1')).toBe('Ab3_xY-1');
    expect(parseRoomSlug('/room/abcd/ended')).toBe('abcd');
    expect(parseRoomSlug('Join me\nhttps://x.test/room/abcd?x=1\nPassword: secret')).toBe('abcd');
  });

  it('rejects empty text, titles, and short codes', () => {
    expect(parseRoomSlug('')).toBeNull();
    expect(parseRoomSlug('   ')).toBeNull();
    expect(parseRoomSlug('abc')).toBeNull();
    expect(parseRoomSlug('Join me in Friday')).toBeNull();
    expect(parseRoomSlug('https://example.com/listen/abcd')).toBeNull();
  });
});

describe('pending room', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns the slug once, then forgets it', () => {
    rememberPendingRoom('abcd');
    expect(consumePendingRoom()).toBe('abcd');
    expect(consumePendingRoom()).toBeNull();
  });

  it('drops a stored value that is not a room code', () => {
    sessionStorage.setItem('podchat:pendingRoom', '../admin');
    expect(consumePendingRoom()).toBeNull();
    expect(sessionStorage.getItem('podchat:pendingRoom')).toBeNull();
  });
});
