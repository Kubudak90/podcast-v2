import { describe, expect, it } from 'vitest';
import { publishesAudio } from '../lib/participants';

describe('publishesAudio', () => {
  it('treats a missing permission as on-mic', () => {
    expect(publishesAudio(undefined)).toBe(true);
    expect(publishesAudio(null)).toBe(true);
  });

  it('keeps listeners who cannot publish out of the speaker row', () => {
    expect(publishesAudio({ canPublish: false })).toBe(false);
  });

  it('keeps speakers who can publish', () => {
    expect(publishesAudio({ canPublish: true })).toBe(true);
  });
});
