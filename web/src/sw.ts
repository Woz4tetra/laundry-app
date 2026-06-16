/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Precache the built app shell (manifest injected at build time).
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Show wash/dry notifications even when the app is closed.
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; loadId?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: 'Laundry', body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Laundry', {
      body: payload.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [120, 60, 120],
      tag: payload.loadId || 'laundry',
      data: { loadId: payload.loadId },
    } as NotificationOptions),
  );
});

// Focus (or open) the app and deep-link to the relevant load on tap.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const loadId = event.notification.data?.loadId;
  const url = loadId ? `/run/${loadId}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
