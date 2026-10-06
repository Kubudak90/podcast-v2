import { describe, expect, it } from 'vitest';
import { formatLiveDuration, liveStartFromStatus } from '../lib/liveClock';

describe('formatLiveDuration', () => {
  const start = '2026-10-06T04:00:00.000Z';
  const startMs = new Date(start).getTime();

  it('stays at 00:00 without a start time', () => {
    expect(formatLiveDuration(null, startMs)).toBe('00:00');
  });

  it('counts minutes and seconds from the server start', () => {
    expect(formatLiveDuration(start, startMs + 125_000)).toBe('02:05');
  });

  it('includes hours after 60 minutes', () => {
    expect(formatLiveDuration(start, startMs + 3_661_000)).toBe('1:01:01');
  });

  it('does not go negative if the clock is behind', () => {
    expect(formatLiveDuration(start, startMs - 5_000)).toBe('00:00');
  });
});

describe('liveStartFromStatus', () => {
  it('uses the server timestamp when the room goes live', () => {
    expect(
      liveStartFromStatus(null, { status: 'live', startedAt: '2026-10-06T04:00:00.000Z' }, '2026-10-06T04:00:03.000Z'),
    ).toBe('2026-10-06T04:00:00.000Z');
  });

  it('keeps an existing start when a later live event omits it', () => {
    expect(
      liveStartFromStatus('2026-10-06T04:00:00.000Z', { status: 'live' }, '2026-10-06T04:00:03.000Z'),
    ).toBe('2026-10-06T04:00:00.000Z');
  });

  it('falls back to now only when nothing else is known', () => {
    expect(liveStartFromStatus(null, { status: 'live' }, '2026-10-06T04:00:03.000Z')).toBe('2026-10-06T04:00:03.000Z');
  });

  it('ignores non-live updates', () => {
    expect(liveStartFromStatus(null, { status: 'ended', startedAt: '2026-10-06T04:00:00.000Z' }, 'now')).toBeNull();
  });
});
