export const DEFAULT_DOCUMENT_TITLE = 'PodChat - Canli Podcast';

const BRAND = 'PodChat';
const MAX_LABEL = 80;

export interface PageTitleContext {
  roomSlug?: string | null;
  roomTitle?: string | null;
}

function cleanLabel(label: string): string {
  let text = '';
  for (const char of label) {
    const code = char.charCodeAt(0);
    text += code < 32 || code === 127 ? ' ' : char;
  }
  return text.replace(/\s+/g, ' ').trim();
}

export function formatPageTitle(label: string): string {
  const cleaned = cleanLabel(label);
  const text = cleaned.length > MAX_LABEL ? `${cleaned.slice(0, MAX_LABEL - 1).trimEnd()}…` : cleaned;
  return `${text || BRAND} · ${BRAND}`;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function roomLabel(slug: string, ended: boolean, context?: PageTitleContext): string {
  const roomSlug = context?.roomSlug ?? null;
  const roomTitle = cleanLabel(context?.roomTitle ?? '');
  if (roomSlug === slug && roomTitle) return roomTitle;
  return ended ? 'Yayin bitti' : 'Oda';
}

/** Title for a known screen, or null when this path should keep whatever is already set. */
export function pageTitleForPath(pathname: string, context?: PageTitleContext): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/') return formatPageTitle('Ana sayfa');
  if (path === '/login') return formatPageTitle('Giris');
  if (path === '/signup') return formatPageTitle('Kayit');
  if (path === '/create-room') return formatPageTitle('Oda olustur');
  if (path === '/library') return formatPageTitle('Kutuphane');
  if (path === '/profile') return formatPageTitle('Profil');
  if (path === '/join') return formatPageTitle('Odaya katil');
  if (path === '/forgot-password') return formatPageTitle('Sifremi unuttum');
  if (path === '/reset-password') return formatPageTitle('Sifre sifirla');

  const room = path.match(/^\/room\/([^/]+)(\/ended)?$/);
  if (room) {
    return formatPageTitle(roomLabel(decodeSegment(room[1]), Boolean(room[2]), context));
  }

  if (/^\/listen\/[^/]+$/.test(path)) return formatPageTitle('Dinle');
  if (/^\/u\/[^/]+$/.test(path)) return formatPageTitle('Profil');

  return null;
}
