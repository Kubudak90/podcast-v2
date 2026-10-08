// Live room recordings are audio-only MP3 (see startRoomRecording). The row's
// format must follow the stored file, and duration must fit a Postgres INT4.

const INT4_MAX = 2_147_483_647;

const FORMAT_BY_EXT: Record<string, string> = {
  mp3: 'mp3',
  mpeg: 'mp3',
  m4a: 'm4a',
  aac: 'aac',
  mp4: 'mp4',
  ogg: 'ogg',
  wav: 'wav',
};

export function formatFromRecordingUrl(fileUrl: string): string {
  const path = fileUrl.split('?')[0]?.split('#')[0] ?? '';
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return 'mp3';
  const ext = base.slice(dot + 1).toLowerCase();
  return FORMAT_BY_EXT[ext] ?? 'mp3';
}

export function clampRecordingDuration(seconds: number | null): number | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const whole = Math.floor(seconds);
  if (whole < 0 || whole > INT4_MAX) return null;
  return whole;
}

export function egressRecordingFields(
  fileUrl: string,
  startedAt: Date | null,
  now = Date.now(),
): { format: string; durationSeconds: number | null } {
  const raw = startedAt ? (now - startedAt.getTime()) / 1000 : null;
  return {
    format: formatFromRecordingUrl(fileUrl),
    durationSeconds: clampRecordingDuration(raw),
  };
}
