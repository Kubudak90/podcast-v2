export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const POSITION_PREFIX = 'podchat:listen:';
const RATE_KEY = 'podchat:playbackRate';

/** Ignore tiny offsets so a brand-new listen does not look like a resume. */
export const RESUME_MIN_SECONDS = 3;
/** Drop the saved spot once the episode is essentially finished. */
export const END_MARGIN_SECONDS = 5;

export function positionKey(shareSlug: string): string {
  return `${POSITION_PREFIX}${shareSlug}`;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or a full quota should not break playback.
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function isPlaybackRate(value: number): value is PlaybackRate {
  return (PLAYBACK_RATES as readonly number[]).includes(value);
}

export function readPlaybackRate(): PlaybackRate {
  const parsed = Number(storageGet(RATE_KEY));
  return isPlaybackRate(parsed) ? parsed : 1;
}

export function writePlaybackRate(rate: PlaybackRate): void {
  storageSet(RATE_KEY, String(rate));
}

export function readResumePosition(shareSlug: string, duration: number): number | null {
  const saved = Number(storageGet(positionKey(shareSlug)));
  if (!Number.isFinite(saved) || !Number.isFinite(duration) || duration <= 0) return null;
  if (saved < RESUME_MIN_SECONDS || saved >= duration - END_MARGIN_SECONDS) return null;
  return saved;
}

export function writeResumePosition(shareSlug: string, currentTime: number, duration: number): void {
  const key = positionKey(shareSlug);
  if (!Number.isFinite(currentTime) || currentTime < 1) {
    storageRemove(key);
    return;
  }
  if (Number.isFinite(duration) && duration - currentTime < END_MARGIN_SECONDS) {
    storageRemove(key);
    return;
  }
  storageSet(key, String(Math.floor(currentTime)));
}

export function clearResumePosition(shareSlug: string): void {
  storageRemove(positionKey(shareSlug));
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = hours > 0 ? String(mins).padStart(2, '0') : String(mins);
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
