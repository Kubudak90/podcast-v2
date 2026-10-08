import { describe, expect, it } from 'vitest';
import {
  clampRecordingDuration,
  egressRecordingFields,
  formatFromRecordingUrl,
} from '../lib/recordingMeta.js';

describe('formatFromRecordingUrl', () => {
  it('reads the mp3 egress filename', () => {
    expect(
      formatFromRecordingUrl(
        'https://s3.example.com/podchat-recordings/recordings/room-1710000000000.mp3',
      ),
    ).toBe('mp3');
    expect(formatFromRecordingUrl('local:///recordings/abc-1.mp3')).toBe('mp3');
  });

  it('ignores query, hash, and letter case', () => {
    expect(formatFromRecordingUrl('https://cdn.example/file.MP3?token=1#x')).toBe('mp3');
  });

  it('keeps a real container when the url says so', () => {
    expect(formatFromRecordingUrl('https://cdn.example/talk.m4a')).toBe('m4a');
    expect(formatFromRecordingUrl('https://cdn.example/talk.mp4')).toBe('mp4');
  });

  it('defaults to mp3 when the extension is missing or unknown', () => {
    expect(formatFromRecordingUrl('https://cdn.example/recordings/room')).toBe('mp3');
    expect(formatFromRecordingUrl('local:///recordings/')).toBe('mp3');
    expect(formatFromRecordingUrl('https://cdn.example/talk.xyz')).toBe('mp3');
    expect(formatFromRecordingUrl('')).toBe('mp3');
  });
});

describe('clampRecordingDuration', () => {
  it('keeps a whole non-negative duration that fits INT4', () => {
    expect(clampRecordingDuration(0)).toBe(0);
    expect(clampRecordingDuration(90.9)).toBe(90);
    expect(clampRecordingDuration(2_147_483_647)).toBe(2_147_483_647);
  });

  it('drops negative, non-finite, and overflowing values', () => {
    expect(clampRecordingDuration(-1)).toBeNull();
    expect(clampRecordingDuration(Number.NaN)).toBeNull();
    expect(clampRecordingDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(clampRecordingDuration(2_147_483_648)).toBeNull();
    expect(clampRecordingDuration(null)).toBeNull();
  });
});

describe('egressRecordingFields', () => {
  const now = Date.parse('2026-10-08T13:00:00.000Z');

  it('pairs the file extension with elapsed seconds', () => {
    const startedAt = new Date(now - 125_000);
    expect(egressRecordingFields('local:///recordings/room.mp3', startedAt, now)).toEqual({
      format: 'mp3',
      durationSeconds: 125,
    });
  });

  it('stores null when the room never started or the clock is ahead', () => {
    expect(egressRecordingFields('local:///recordings/room.mp3', null, now)).toEqual({
      format: 'mp3',
      durationSeconds: null,
    });
    const future = new Date(now + 60_000);
    expect(
      egressRecordingFields('local:///recordings/room.mp3', future, now).durationSeconds,
    ).toBeNull();
  });
});
