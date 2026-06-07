/**
 * KFMS Service Worker
 * Handles offline caching, background sync, and push notifications
 * Registered via vite-plugin-pwa
 */

const CACHE_NAME = 'kfms-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// ── Install: cache static shell ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ──────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', offline: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback to app shell for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'kfms-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Notify the app to run its sync engine
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SW_SYNC_TRIGGER' }));
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Kenena Farm', body: event.data.text() }; }

  const iconMap = {
    vaccination_due: '💉',
    low_stock: '📦',
    approval_required: '✅',
    mortality_spike: '🚨',
    payroll_due: '👷',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Kenena Farm', {
      body: data.message || data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: data.type || 'kfms',
      renotify: true,
      requireInteraction: data.type === 'approval_required' || data.type === 'mortality_spike',
      data: { url: data.url || '/', type: data.type },
      actions: data.type === 'approval_required' ? [
        { action: 'approve', title: '✓ Approve' },
        { action: 'view', title: 'View Details' }
      ] : [{ action: 'view', title: 'View' }],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.postMessage({ type: 'NAVIGATE', url: targetUrl }); }
      else self.clients.openWindow(targetUrl);
    })
  );
});
