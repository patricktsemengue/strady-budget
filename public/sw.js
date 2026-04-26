// Service Worker for Client-Side Balance Aggregation
const VERSION = '1.0.4';
const CACHE_NAME = `strady-cache-${VERSION}`;
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/styles.css',
    '/manifest.json',
    '/S-fav-icon.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://unpkg.com/i18next/dist/umd/i18next.min.js'
];

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithCustomToken, signInWithCredential, GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, getDocs, setDoc, updateDoc, doc, query, where, orderBy, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calculateBalanceDelta, sweepAccountBalances } from "./js/balance-engine.js";

let db;
let auth;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Firebase and internal API calls to ensure fresh data
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('google.com/recaptcha')) return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    if (type === 'INIT_FIREBASE') {
        if (!db) {
            console.log('SW: Initializing Firebase...');
            const app = initializeApp(payload.config);
            db = getFirestore(app);
            auth = getAuth(app);
            
            // Listen for auth state changes within the SW
            // If persistence is shared (same origin), it might pick up the session
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('SW: Auth state changed - User is signed in:', user.uid);
                } else {
                    console.log('SW: Auth state changed - No user');
                }
            });
        }
        return;
    }

    if (type === 'REFRESH_BALANCES') {
        const { userId, action, data } = payload;
        if (!db) {
            console.warn('[SW] Database not initialized');
            return;
        }

        // Wait for auth to be ready if possible, or check if current user matches
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
            console.warn(`[SW] Auth mismatch or missing. Expected: ${userId}, Got: ${auth.currentUser?.uid}. Falling back.`);
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'REFRESH_FAILED',
                    payload: { userId, action, data, error: 'Authentication missing or mismatched in Service Worker' }
                });
            });
            return;
        }

        console.log(`[SW] Starting balance ${action} refresh for ${userId}...`);
        try {
            if (action === 'DELTA') {
                // Surgical update for single transactions
                await calculateBalanceDelta(
                    db, userId, data.accountId, data.amount, data.date,
                    getDocs, updateDoc, setDoc, doc, collection, query, where, orderBy, limit, serverTimestamp
                );
            } else if (action === 'SWEEP') {
                // Full chronological rebuild for accounts
                await sweepAccountBalances(
                    db, userId, data.accountIds,
                    getDocs, setDoc, updateDoc, doc, collection, query, where, orderBy, limit, serverTimestamp
                );
            }
            console.log(`[SW] ${action} refresh complete.`);

            // Signal completion to UI to clear dirty flags
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'REFRESH_COMPLETE',
                    payload: { accountIds: action === 'DELTA' ? [data.accountId] : data.accountIds }
                });
            });
        } catch (error) {
            console.error("SW Balance Refresh Error:", error);
            // Signal failure to UI to trigger fallback
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'REFRESH_FAILED',
                    payload: { userId, action, data, error: error.message }
                });
            });
        }
    }
});
