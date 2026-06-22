import { describe, it, expect } from 'vitest';
import { audioExtForMime } from '../lib/storage.js';

describe('audioExtForMime', () => {
  it('maps allowed audio MIME types to stored extensions', () => {
    expect(audioExtForMime('audio/mpeg')).toBe('mp3');
    expect(audioExtForMime('audio/mp4')).toBe('m4a');
    expect(audioExtForMime('audio/x-m4a')).toBe('m4a');
    expect(audioExtForMime('audio/aac')).toBe('aac');
  });

  it('returns null for disallowed or empty types', () => {
    expect(audioExtForMime('image/png')).toBeNull();
    expect(audioExtForMime('video/mp4')).toBeNull();
    expect(audioExtForMime('')).toBeNull();
  });
});
