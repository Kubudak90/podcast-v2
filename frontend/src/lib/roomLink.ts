const SLUG = /^[A-Za-z0-9_-]{4,32}$/;
const ROOM_PATH = /\/room\/([A-Za-z0-9_-]{4,32})(?![A-Za-z0-9_-])/;
const PENDING_ROOM_KEY = 'podchat:pendingRoom';

/** Pull a room slug out of a code, a /room/ link, or a shared invite. */
export function parseRoomSlug(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const fromPath = text.match(ROOM_PATH);
  if (fromPath) return fromPath[1];

  if (/\s/.test(text)) return null;

  const slug = text.replace(/^@/, '').replace(/[.,;]+$/, '');
  return SLUG.test(slug) ? slug : null;
}

export function rememberPendingRoom(slug: string): void {
  sessionStorage.setItem(PENDING_ROOM_KEY, slug);
}

/** Read and clear a room the user tried to join before signing in. */
export function consumePendingRoom(): string | null {
  const slug = sessionStorage.getItem(PENDING_ROOM_KEY);
  sessionStorage.removeItem(PENDING_ROOM_KEY);
  return slug && SLUG.test(slug) ? slug : null;
}
