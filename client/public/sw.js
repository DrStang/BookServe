/**
 * BookServe Service Worker
 *
 * Provides:
 * - Offline support for the app shell
 * - Caching of book covers and static assets
 * - Background sync for reading progress
 * - Offline reading capability for downloaded books
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `bookserve-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `bookserve-dynamic-${CACHE_VERSION}`;
const BOOK_CACHE = `bookserve-books-${CACHE_VERSION}`;
const IMAGE_CACHE = `bookserve-images-${CACHE_VERSION}`;

// Files to cache immediately on install
const STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json'
];

// Maximum cache sizes
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 200;
const MAX_BOOK_CACHE = 20;

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static files');
                return cache.addAll(STATIC_FILES).catch(err => {
                    console.warn('[SW] Some static files failed to cache:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('bookserve-') &&
                                name !== STATIC_CACHE &&
                                name !== DYNAMIC_CACHE &&
                                name !== BOOK_CACHE &&
                                name !== IMAGE_CACHE;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

/**
 * Limit cache size by removing oldest entries
 */
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length > maxItems) {
        await cache.delete(keys[0]);
        return trimCache(cacheName, maxItems);
    }
}

/**
 * Network-first strategy with cache fallback
 */
async function networkFirst(request, cacheName = DYNAMIC_CACHE) {
    try {
        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
            trimCache(cacheName, MAX_DYNAMIC_CACHE);
        }

        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }

        throw error;
    }
}

/**
 * Cache-first strategy with network fallback
 */
async function cacheFirst(request, cacheName = STATIC_CACHE) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Return a placeholder for images
        if (request.destination === 'image') {
            return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect fill="#1a1a1a" width="200" height="300"/><text fill="#666" x="50%" y="50%" text-anchor="middle">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
            );
        }
        throw error;
    }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request, cacheName = DYNAMIC_CACHE) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => cached);

    return cached || fetchPromise;
}

/**
 * Fetch event - route requests to appropriate strategy
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests
    if (url.origin !== location.origin) return;

    // API requests - network first
    if (url.pathname.startsWith('/api/')) {
        // Book downloads - cache for offline reading
        if (url.pathname.includes('/download') || url.pathname.includes('/stream')) {
            event.respondWith(cacheFirst(request, BOOK_CACHE));
            return;
        }

        // Cover images - cache aggressively
        if (url.pathname.includes('/cover')) {
            event.respondWith(cacheFirst(request, IMAGE_CACHE));
            trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE);
            return;
        }

        // Other API calls - network first
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Static assets - cache first
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // HTML pages - stale while revalidate
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Try network first for navigation
                    const response = await fetch(request);
                    const cache = await caches.open(DYNAMIC_CACHE);
                    cache.put(request, response.clone());
                    return response;
                } catch (error) {
                    // Try cache
                    const cached = await caches.match(request);
                    if (cached) return cached;

                    // Try index.html for SPA routes
                    const indexCached = await caches.match('/index.html');
                    if (indexCached) return indexCached;

                    // Return offline page
                    return caches.match('/offline.html');
                }
            })()
        );
        return;
    }

    // Default - stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
});

/**
 * Background sync for reading progress
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-progress') {
        event.waitUntil(syncReadingProgress());
    }
});

async function syncReadingProgress() {
    try {
        // Get pending progress updates from IndexedDB
        const pendingUpdates = await getPendingProgressUpdates();

        for (const update of pendingUpdates) {
            try {
                const response = await fetch('/api/progress', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${update.token}`
                    },
                    body: JSON.stringify(update.data)
                });

                if (response.ok) {
                    await removePendingProgressUpdate(update.id);
                }
            } catch (e) {
                console.warn('[SW] Failed to sync progress:', e);
            }
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

// IndexedDB helpers for offline progress storage
const DB_NAME = 'bookserve-offline';
const DB_VERSION = 1;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('pendingProgress')) {
                db.createObjectStore('pendingProgress', { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains('offlineBooks')) {
                db.createObjectStore('offlineBooks', { keyPath: 'bookId' });
            }
        };
    });
}

async function getPendingProgressUpdates() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingProgress', 'readonly');
        const store = tx.objectStore('pendingProgress');
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

async function removePendingProgressUpdate(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingProgress', 'readwrite');
        const store = tx.objectStore('pendingProgress');
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Push notifications
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'BookServe', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

/**
 * Message handling from main app
 */
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CACHE_BOOK') {
        // Cache a book for offline reading
        const { bookId, url } = event.data;
        caches.open(BOOK_CACHE).then((cache) => {
            cache.add(url).then(() => {
                console.log(`[SW] Cached book ${bookId} for offline reading`);
            });
        });
    }

    if (event.data.type === 'REMOVE_CACHED_BOOK') {
        // Remove a book from offline cache
        const { url } = event.data;
        caches.open(BOOK_CACHE).then((cache) => {
            cache.delete(url);
        });
    }

    if (event.data.type === 'SAVE_PROGRESS_OFFLINE') {
        // Save reading progress for sync when online
        openDatabase().then((db) => {
            const tx = db.transaction('pendingProgress', 'readwrite');
            const store = tx.objectStore('pendingProgress');
            store.add(event.data.progress);
        });
    }
});

console.log('[SW] Service worker loaded');
