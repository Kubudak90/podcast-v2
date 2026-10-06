import { afterEach, beforeEach, describe, expect, it, type Mock } from 'vitest';
import {
  clearResumePosition,
  formatPlaybackTime,
  readPlaybackRate,
  readResumePosition,
  writePlaybackRate,
  writeResumePosition,
} from '../lib/playback';

const store = new Map<string, string>();
const getItem = localStorage.getItem as unknown as Mock<(key: string) => string | null>;
const setItem = localStorage.setItem as unknown as Mock<(key: string, value: string) => void>;
const removeItem = localStorage.removeItem as unknown as Mock<(key: string) => void>;

beforeEach(() => {
  store.clear();
  getItem.mockImplementation((key: string) => store.get(key) ?? null);
  setItem.mockImplementation((key: string, value: string) => {
    store.set(key, value);
  });
  removeItem.mockImplementation((key: string) => {
    store.delete(key);
  });
});

afterEach(() => {
  getItem.mockReset();
  setItem.mockReset();
  removeItem.mockReset();
});

describe('playback storage', () => {
  it('defaults the rate to 1x', () => {
    expect(readPlaybackRate()).toBe(1);
  });

  it('remembers a supported playback rate', () => {
    writePlaybackRate(1.5);
    expect(readPlaybackRate()).toBe(1.5);
  });

  it('ignores an unsupported stored rate', () => {
    setItem('podchat:playbackRate', '3');
    expect(readPlaybackRate()).toBe(1);
  });

  it('resumes only inside the episode', () => {
    writeResumePosition('ep-1', 125.8, 600);
    expect(readResumePosition('ep-1', 600)).toBe(125);
    expect(readResumePosition('ep-1', 100)).toBeNull();
  });

  it('forgets a spot at the start or the end', () => {
    writeResumePosition('ep-1', 2, 600);
    expect(readResumePosition('ep-1', 600)).toBeNull();

    writeResumePosition('ep-1', 597, 600);
    expect(store.has('podchat:listen:ep-1')).toBe(false);
  });

  it('clears a saved position', () => {
    writeResumePosition('ep-1', 40, 600);
    clearResumePosition('ep-1');
    expect(readResumePosition('ep-1', 600)).toBeNull();
  });
});

describe('formatPlaybackTime', () => {
  it('formats minutes and hours', () => {
    expect(formatPlaybackTime(0)).toBe('0:00');
    expect(formatPlaybackTime(65)).toBe('1:05');
    expect(formatPlaybackTime(3723)).toBe('1:02:03');
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00');
  });
});
