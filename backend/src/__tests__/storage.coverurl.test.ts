import { describe, it, expect } from 'vitest';
import { buildCoverImageUrl } from '../lib/storage.js';

describe('buildCoverImageUrl', () => {
  it('returns null when there is no cover key', () => {
    expect(buildCoverImageUrl('rec-1', null)).toBeNull();
    expect(buildCoverImageUrl('rec-1', undefined)).toBeNull();
  });

  it('builds a cover URL ending in the recording cover path with a 12-hex cache buster', () => {
    const url = buildCoverImageUrl('rec-1', 'local:///recordings/covers/rec-1-abc.jpg');
    expect(url).toMatch(/\/api\/recordings\/rec-1\/cover\?v=[0-9a-f]{12}$/);
  });

  it('is deterministic for the same key and differs for different keys', () => {
    const a = buildCoverImageUrl('rec-1', 'covers/a.jpg');
    const a2 = buildCoverImageUrl('rec-1', 'covers/a.jpg');
    const b = buildCoverImageUrl('rec-1', 'covers/b.jpg');
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });
});
