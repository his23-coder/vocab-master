const CACHE_NAME = 'vocabmaster-v13';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/storage.js',
    './js/ai.js',
    './js/audio.js',
    './js/gdrive.js',
    './js/app.js',
    './manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // APIおよび同期通信はキャッシュしない
    if (e.request.url.includes('generativelanguage.googleapis.com') ||
        e.request.url.includes('script.google.com') ||
        e.request.url.includes('script.googleusercontent.com')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetched = fetch(e.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});
