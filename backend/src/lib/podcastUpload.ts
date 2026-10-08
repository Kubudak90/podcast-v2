// Upload metadata that is safe to store. Titles match the share form's 100
// character cap. Durations must fit a Postgres INT4 or the insert 500s.

const MAX_TITLE_LENGTH = 100;
const FALLBACK_TITLE = 'Adsız podcast';
const INT4_MAX = 2_147_483_647;

function isUnsafeTitleChar(code: number): boolean {
  return (
    code <= 0x1f ||
    code === 0x7f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

function cleanTitle(value: string): string {
  let cleaned = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    cleaned += isUnsafeTitleChar(code) ? ' ' : char;
  }
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

function fileStem(originalName: string): string {
  const base = (originalName.split(/[/\\]/).pop() ?? '').trim();
  return base.replace(/\.[^./\\]+$/, '');
}

export function podcastTitleFromUpload(explicit: unknown, originalName: unknown): string {
  if (typeof explicit === 'string') {
    const fromField = cleanTitle(explicit);
    if (fromField) return fromField;
  }

  if (typeof originalName === 'string') {
    const fromFile = cleanTitle(fileStem(originalName));
    if (fromFile) return fromFile;
  }

  return FALLBACK_TITLE;
}

export function podcastDurationSeconds(raw: unknown): number | null {
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const whole = Math.floor(n);
  if (whole > INT4_MAX) return null;
  return whole;
}
