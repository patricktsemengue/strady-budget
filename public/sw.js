// Service Worker for Client-Side Balance Aggregation
const VERSION = '1.0.2';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithCustomToken, signInWithCredential, GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, getDocs, setDoc, updateDoc, doc, query, where, orderBy, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calculateBalanceDelta, sweepAccountBalances } from "./js/balance-engine.js";

let db;

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    if (type === 'INIT_FIREBASE') {
        if (!db) {
            console.log('SW: Initializing Firebase...');
            const app = initializeApp(payload.config);
            db = getFirestore(app);
        }
        
        if (payload.token) {
            console.log('SW: Received ID token');
            // ID tokens cannot be used directly with signInWithCustomToken.
            // However, the web SDK in a SW doesn't support easy auth sync yet.
            // If the user's browser supports it, auth might sync automatically if indexedDB is used.
        }
        return;
    }

    if (type === 'REFRESH_BALANCES') {
        const { userId, action, data } = payload;
        if (!db) return;

        console.log(`[SW] Starting balance ${action} refresh...`);
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
