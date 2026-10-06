/** Elapsed clock for a live room. Stays at 00:00 until the broadcast has a start time. */
export function formatLiveDuration(startedAt: string | null, nowMs: number): string {
  if (!startedAt) return '00:00';
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return '00:00';
  const totalSeconds = Math.floor(Math.max(0, nowMs - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Keep the server start time when a room goes live.
 * A later event without startedAt must not wipe a time we already have.
 */
export function liveStartFromStatus(
  current: string | null,
  payload: { status: string; startedAt?: string },
  nowIso: string,
): string | null {
  if (payload.status !== 'live') return current;
  return payload.startedAt || current || nowIso;
}
