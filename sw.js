const CACHE_NAME = 'baby-tracker-cache-v8';
const APP_SHELL = [
'./',
'./index.html?v=8',
'./manifest.json?v=8',
'./icon-192.png',
'./icon-512.png'
];

self.addEventListener('install', event => {
self.skipWaiting();
event.waitUntil(
caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
);
});

self.addEventListener('activate', event => {
event.waitUntil((async () => {
const keys = await caches.keys();
await Promise.all(
keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
);
await self.clients.claim();
})());
});

self.addEventListener('fetch', event => {
const req = event.request;
const url = new URL(req.url);

if (req.method !== 'GET') return;

if (url.origin !== location.origin) {
return;
}

if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
event.respondWith((async () => {
try {
const fresh = await fetch(req, { cache: 'no-store' });
const cache = await caches.open(CACHE_NAME);
cache.put('./index.html', fresh.clone());
return fresh;
} catch (err) {
const cached = await caches.match('./index.html');
return cached || Response.error();
}
})());
return;
}

event.respondWith((async () => {
const cached = await caches.match(req);
if (cached) return cached;

const fresh = await fetch(req);
const cache = await caches.open(CACHE_NAME);
cache.put(req, fresh.clone());
return fresh;
})());
});
