// The service worker: what lets WintArc be installed as an app, and what
// receives reminders when the app isn't open. It deliberately doesn't cache
// anything, so there is never a stale copy of the app or of anyone's data.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Present so browsers treat the site as installable; requests go to the
// network exactly as they would without it.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    // Not one of ours: show the plain fallback below.
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'WintArc', {
      body: message.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      // One reminder replaces the last rather than stacking up.
      tag: 'wintarc-reminder',
      data: { url: message.url || '/' },
    }),
  )
})

// Tapping a reminder brings the app forward, or opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      if (open) return open.navigate ? open.navigate(url).then((w) => (w || open).focus()) : open.focus()
      return self.clients.openWindow(url)
    }),
  )
})
