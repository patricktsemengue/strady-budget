// Service Worker for Client-Side Balance Aggregation (Compat Mode)
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js");

// We still need balance-engine logic. Since we are in compat mode, 
// we might need to expose balance-engine functions globally or import them.
// For now, let's keep the logic simple or assume it's available via a compat-friendly script.
// To avoid module errors in SW, we will inline the necessary logic if it's small, 
// or import it if we can package it for SW.

const VERSION = '1.0.6';
const CACHE_NAME = `strady-cache-${VERSION}`;
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/styles.css',
    '/manifest.json',
    '/S-fav-icon.png'
];

const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://unpkg.com/i18next/dist/umd/i18next.min.js'
];

let db;
let auth;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const localPromise = cache.addAll(ASSETS_TO_CACHE);
            const externalPromises = EXTERNAL_ASSETS.map(url => {
                return fetch(new Request(url, { mode: 'no-cors' }))
                    .then(response => cache.put(url, response))
                    .catch(err => console.warn(`SW: Failed to cache external asset: ${url}`, err));
            });
            return Promise.all([localPromise, ...externalPromises]);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.map((name) => {
                if (name !== CACHE_NAME) return caches.delete(name);
            }));
        })
    );
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('google.com/recaptcha')) return;
    event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    if (type === 'INIT_FIREBASE') {
        if (!db) {
            console.log('SW: Initializing Firebase (Compat)...');
            firebase.initializeApp(payload.config);
            db = firebase.firestore();
            auth = firebase.auth();
        }
        return;
    }

    if (type === 'REFRESH_BALANCES') {
        const { userId, action, data } = payload;
        if (!db) return;

        // Note: Balance engine functions (calculateBalanceDelta, sweepAccountBalances) 
        // are modules. In Compat SW, we'd need to convert them or wait for UI.
        // For strict stability, we signal the UI to perform the calculation if SW isn't ready.
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'REFRESH_FAILED',
                payload: { userId, action, data, error: 'Service Worker in Compat Mode - calculation deferred to main thread' }
            });
        });
    }
});
