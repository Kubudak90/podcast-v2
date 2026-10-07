import { describe, expect, it } from 'vitest';
import {
  getLocalRecordingPath,
  isInsideRecordingsDir,
  normalizeObjectKey,
  objectKeyFromStoredUrl,
} from '../lib/storage.js';

describe('normalizeObjectKey', () => {
  it('strips the bucket prefix that path-style R2 URLs leave on the key', () => {
    expect(normalizeObjectKey('podchat-recordings/recordings/room-1.mp3')).toBe('recordings/room-1.mp3');
    expect(normalizeObjectKey('/podchat-recordings/covers/rec-1.jpg')).toBe('covers/rec-1.jpg');
  });

  it('leaves a virtual-hosted object key unchanged', () => {
    expect(normalizeObjectKey('recordings/room-1.mp3')).toBe('recordings/room-1.mp3');
    expect(normalizeObjectKey('/uploads/abc.m4a')).toBe('uploads/abc.m4a');
  });

  it('reads the object key from a stored URL', () => {
    expect(
      objectKeyFromStoredUrl(
        'https://xxx.r2.cloudflarestorage.com/podchat-recordings/recordings/room-1.mp3'
      )
    ).toBe('recordings/room-1.mp3');

    expect(
      objectKeyFromStoredUrl('https://podchat-recordings.s3.auto.amazonaws.com/recordings/room-1.mp3')
    ).toBe('recordings/room-1.mp3');
  });

  it('rejects empty keys and parent-directory segments', () => {
    expect(() => normalizeObjectKey('')).toThrow(/Invalid storage key/);
    expect(() => normalizeObjectKey('podchat-recordings/')).toThrow(/Invalid storage key/);
    expect(() => normalizeObjectKey('recordings/../etc/passwd')).toThrow(/Invalid storage key/);
    expect(() => normalizeObjectKey('covers/a\\b.jpg')).toThrow(/Invalid storage key/);
  });
});

describe('getLocalRecordingPath', () => {
  it('returns a file stored under the recordings directory', () => {
    expect(getLocalRecordingPath('local:///recordings/uploads/a.mp3')).toBe('/recordings/uploads/a.mp3');
    expect(getLocalRecordingPath('file:///recordings/covers/a.jpg')).toBe('/recordings/covers/a.jpg');
    expect(getLocalRecordingPath('/recordings/uploads/a.mp3')).toBe('/recordings/uploads/a.mp3');
  });

  it('rejects a sibling directory that only shares the recordings prefix', () => {
    expect(isInsideRecordingsDir('/recordings-evil/secret')).toBe(false);
    expect(() => getLocalRecordingPath('local:///recordings-evil/secret')).toThrow(/Invalid local recording path/);
    expect(() => getLocalRecordingPath('/recordings-other/secret.mp3')).toThrow(/Invalid local recording path/);
  });

  it('rejects paths that climb out of the recordings directory', () => {
    expect(() => getLocalRecordingPath('local:///recordings/../etc/passwd')).toThrow(/Invalid local recording path/);
    expect(() => getLocalRecordingPath('local:///recordings/%2e%2e/etc/passwd')).toThrow(
      /Invalid local recording path/
    );
    expect(() => getLocalRecordingPath('file:///etc/passwd')).toThrow(/Invalid local recording path/);
    expect(() => getLocalRecordingPath('/recordings')).toThrow(/Invalid local recording path/);
  });
});
