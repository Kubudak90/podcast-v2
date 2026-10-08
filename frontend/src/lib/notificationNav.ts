export interface NotificationWindowClient {
  url: string;
  focus: () => Promise<unknown> | void;
  navigate?: (url: string) => Promise<unknown> | void;
}

export interface NotificationClients {
  matchAll: (options: { type: 'window'; includeUncontrolled: boolean }) => Promise<readonly NotificationWindowClient[]>;
  openWindow: (url: string) => Promise<unknown> | null;
}

const ROOM_SLUG = /^[A-Za-z0-9_-]{1,64}$/;

export function notificationTargetPath(data: unknown): string {
  if (!data || typeof data !== 'object') return '/';
  const record = data as { type?: unknown; roomSlug?: unknown };
  if (record.type === 'new_follower') return '/profile';
  if (record.type === 'room_live' && typeof record.roomSlug === 'string' && ROOM_SLUG.test(record.roomSlug)) {
    return `/room/${record.roomSlug}`;
  }
  return '/';
}

export function clientInAppScope(clientUrl: string, scope: string): boolean {
  try {
    const scopeUrl = new URL(scope);
    const client = new URL(clientUrl);
    if (client.origin !== scopeUrl.origin) return false;
    if (scopeUrl.pathname === '/' || scopeUrl.pathname === '') return true;
    const prefix = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
    return client.pathname === scopeUrl.pathname || client.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

// Focus and navigation must stay inside the waitUntil promise. Otherwise the
// browser can stop the service worker before the open tab reaches the room.
export async function openNotificationTarget(
  data: unknown,
  clients: NotificationClients,
  scope: string,
): Promise<void> {
  const url = notificationTargetPath(data);
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of windowClients) {
    if (!clientInAppScope(client.url, scope)) continue;
    try {
      await client.focus();
      if (typeof client.navigate === 'function') {
        await client.navigate(url);
        return;
      }
    } catch {
      continue;
    }
  }

  await clients.openWindow(url);
}
