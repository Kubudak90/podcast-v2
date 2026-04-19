/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'PodChat';
    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag,
      data: data.data,
      requireInteraction: data.data?.type === 'room_live',
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('Error handling push event:', error);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  if (data?.type === 'room_live' && data?.roomSlug) {
    url = `/room/${data.roomSlug}`;
  } else if (data?.type === 'new_follower') {
    url = '/profile';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if any
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
