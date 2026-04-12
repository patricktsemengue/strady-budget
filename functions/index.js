const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const getFunctionalBoundaryDateStr = () => {
    const year = new Date().getFullYear();
    return `${year + 3}-12-31`;
};

/**
 * Incremental balance update as per TODO.md:
 * Selects all records >= balanceDate and updates them.
 * If no record exists for balanceDate, it creates one.
 */
async function calculateBalanceUpdate(transaction, userId, accountId, amount, balanceDate) {
    if (!accountId || accountId === "external") return;

    const balancesColl = db.collection(`users/${userId}/account_balances`);
    const q = balancesColl.where("account_id", "==", accountId)
                          .where("date", ">=", balanceDate);
    
    const snapshot = await transaction.get(q);
    let exactMatch = false;

    if (snapshot.empty) {
        // Case: No records >= balanceDate. 
        // We must create one for balanceDate.
        // To do so, we need the latest balance BEFORE balanceDate.
        const prevQ = balancesColl.where("account_id", "==", accountId)
                                  .where("date", "<", balanceDate)
                                  .orderBy("date", "desc")
                                  .limit(1);
        const prevSnap = await transaction.get(prevQ);
        
        let baseBalance = 0;
        if (!prevSnap.empty) {
            baseBalance = prevSnap.docs[0].data().balance;
        } else {
            // Check account initial balance
            const accSnap = await transaction.get(db.doc(`users/${userId}/accounts/${accountId}`));
            if (accSnap.exists()) {
                baseBalance = accSnap.data().initialBalance || 0;
            }
        }

        const newBalRef = db.doc(`users/${userId}/account_balances/${accountId}_${balanceDate}`);
        transaction.set(newBalRef, {
            account_id: accountId,
            date: balanceDate,
            balance: baseBalance + amount,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        // Update all existing future records
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.date === balanceDate) exactMatch = true;
            transaction.update(doc.ref, {
                balance: data.balance + amount,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        if (!exactMatch) {
            // If we found future records but none exactly at balanceDate, create it.
            // Find latest balance BEFORE balanceDate
            const prevQ = balancesColl.where("account_id", "==", accountId)
                                      .where("date", "<", balanceDate)
                                      .orderBy("date", "desc")
                                      .limit(1);
            const prevSnap = await transaction.get(prevQ);
            
            let baseBalance = 0;
            if (!prevSnap.empty) {
                baseBalance = prevSnap.docs[0].data().balance;
            } else {
                const accSnap = await transaction.get(db.doc(`users/${userId}/accounts/${accountId}`));
                if (accSnap.exists()) {
                    baseBalance = accSnap.data().initialBalance || 0;
                }
            }

            const newBalRef = db.doc(`users/${userId}/account_balances/${accountId}_${balanceDate}`);
            transaction.set(newBalRef, {
                account_id: accountId,
                date: balanceDate,
                balance: baseBalance + amount,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

async function recalculateAll(userId, eventId) {
    const logRef = db.doc(`users/${userId}/system_logs/${eventId}`);
    await db.runTransaction(async (transaction) => {
        const logSnap = await transaction.get(logRef);
        if (logSnap.exists()) return;

        const accountsSnap = await transaction.get(db.collection(`users/${userId}/accounts`));
        const transactionsSnap = await transaction.get(db.collection(`users/${userId}/transactions`));

        const accounts = [];
        accountsSnap.forEach(doc => accounts.push({ id: doc.id, ...doc.data() }));
        const transactions = [];
        transactionsSnap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));

        if (accounts.length === 0) return;
        transactions.sort((a, b) => a.date.localeCompare(b.date));

        // For each account, we create records only for dates where a transaction occurs 
        // (plus the initial balance date)
        const batch = db.batch();
        accounts.forEach(acc => {
            let currentBalance = acc.initialBalance || 0;
            const accTxs = transactions.filter(t => t.source === acc.id || t.destination === acc.id);
            
            // Initial record
            const initDate = acc.createDate || acc.initialBalanceDate || '2000-01-01';
            batch.set(db.doc(`users/${userId}/account_balances/${acc.id}_${initDate}`), {
                account_id: acc.id,
                date: initDate,
                balance: currentBalance,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            accTxs.forEach(tx => {
                if (tx.source === acc.id) currentBalance -= tx.amount;
                if (tx.destination === acc.id) currentBalance += tx.amount;
                
                batch.set(db.doc(`users/${userId}/account_balances/${acc.id}_${tx.date}`), {
                    account_id: acc.id,
                    date: tx.date,
                    balance: currentBalance,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            
            batch.update(db.doc(`users/${userId}/accounts/${acc.id}`), { balanceDirty: false, updated_at: admin.firestore.FieldValue.serverTimestamp() });
        });

        batch.set(logRef, { eventId, status: 'success', completed_at: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
    });
}

exports.onTransactionWrite = onDocumentWritten("users/{userId}/transactions/{txId}", async (event) => {
    const userId = event.params.userId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    await db.runTransaction(async (transaction) => {
        const logRef = db.doc(`users/${userId}/system_logs/${event.id}`);
        const logSnap = await transaction.get(logRef);
        if (logSnap.exists()) return;

        // Optimization: Skip incremental updates if a mass import is in progress
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists() && userSnap.data().isImporting) {
            transaction.set(logRef, { 
                eventId: event.id, 
                status: 'skipped_during_import', 
                completed_at: admin.firestore.FieldValue.serverTimestamp() 
            });
            return;
        }

        const affectedAccountIds = new Set();

        if (before) {
            // Reverse old impact: source +amount, destination -amount
            await calculateBalanceUpdate(transaction, userId, before.source, before.amount, before.date);
            await calculateBalanceUpdate(transaction, userId, before.destination, -before.amount, before.date);
            if (before.source && before.source !== "external") affectedAccountIds.add(before.source);
            if (before.destination && before.destination !== "external") affectedAccountIds.add(before.destination);
        }
        if (after) {
            // Apply new impact: source -amount, destination +amount
            await calculateBalanceUpdate(transaction, userId, after.source, -after.amount, after.date);
            await calculateBalanceUpdate(transaction, userId, after.destination, after.amount, after.date);
            if (after.source && after.source !== "external") affectedAccountIds.add(after.source);
            if (after.destination && after.destination !== "external") affectedAccountIds.add(after.destination);
        }

        // Clear balanceDirty for all affected accounts
        affectedAccountIds.forEach(accId => {
            transaction.update(db.doc(`users/${userId}/accounts/${accId}`), { 
                balanceDirty: false, 
                updated_at: admin.firestore.FieldValue.serverTimestamp() 
            });
        });

        transaction.set(logRef, { eventId: event.id, status: 'success', completed_at: admin.firestore.FieldValue.serverTimestamp() });
    });
});

exports.onTemplateWrite = onDocumentWritten("users/{userId}/recurringTemplates/{tplId}", async (event) => {
    // Template changes trigger full refresh for simplicity due to batch generation
    await recalculateAll(event.params.userId, event.id);
});

exports.onAccountWrite = onDocumentWritten("users/{userId}/accounts/{accId}", async (event) => {
    const after = event.data.after.data();
    const before = event.data.before.data();
    if (after && (after.balanceDirty === true || !before)) {
        await recalculateAll(event.params.userId, event.id);
    }
});
