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

import { openNotificationTarget } from './lib/notificationNav';

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openNotificationTarget(event.notification.data, self.clients, self.registration.scope));
});
