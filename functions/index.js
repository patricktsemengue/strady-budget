const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Utility to split an array into chunks of a specific size.
 * Useful for Firestore batch operations (max 500).
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Incremental balance update as per TODO.md:
 * Selects all records >= balanceDate and updates them.
 * If no record exists for balanceDate, it creates one.
 */
async function calculateBalanceUpdate(transaction, userId, accountId, amount, balanceDate) {
    if (!accountId || accountId === "external" || accountId === "") return;

    const balancesColl = db.collection(`users/${userId}/account_balances`);
    const q = balancesColl.where("account_id", "==", accountId)
                          .where("date", ">=", balanceDate);
    
    const snapshot = await transaction.get(q);
    let exactMatch = false;

    if (snapshot.empty) {
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
    } else {
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.date === balanceDate) exactMatch = true;
            transaction.update(doc.ref, {
                balance: data.balance + amount,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        if (!exactMatch) {
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

/**
 * Robust recalculation for one or more accounts.
 * Handles large datasets using chunked batches.
 */
async function recalculateAccounts(userId, accountIds, eventId) {
    if (!accountIds || accountIds.length === 0) return;

    // 1. Check idempotency / logging
    const logRef = db.doc(`users/${userId}/system_logs/${eventId}`);
    const logSnap = await logRef.get();
    if (logSnap.exists()) return;

    logger.info(`Starting recalculation for user ${userId}, accounts: ${accountIds.join(', ')}`);

    // 2. Fetch required data
    const accountsSnap = await db.collection(`users/${userId}/accounts`).get();
    const transactionsSnap = await db.collection(`users/${userId}/transactions`).get();

    const allAccounts = [];
    accountsSnap.forEach(doc => allAccounts.push({ id: doc.id, ...doc.data() }));
    
    const targetAccounts = allAccounts.filter(a => accountIds.includes(a.id));
    if (targetAccounts.length === 0) return;

    const allTransactions = [];
    transactionsSnap.forEach(doc => allTransactions.push({ id: doc.id, ...doc.data() }));
    allTransactions.sort((a, b) => a.date.localeCompare(b.date));

    const balanceWrites = [];

    // 3. Process each account independently
    for (const acc of targetAccounts) {
        const accTxs = allTransactions.filter(t => t.source === acc.id || t.destination === acc.id);
        
        // Find the base balance (the record matching createDate)
        const initDate = acc.createDate || '2000-01-01';
        const baseBalSnap = await db.doc(`users/${userId}/account_balances/${acc.id}_${initDate}`).get();
        
        let currentBalance = baseBalSnap.exists() ? baseBalSnap.data().balance : 0;

        // Initial checkpoint (ensure it's preserved/updated)
        balanceWrites.push({
            id: `${acc.id}_${initDate}`,
            data: { account_id: acc.id, date: initDate, balance: currentBalance, updated_at: admin.firestore.FieldValue.serverTimestamp() }
        });

        // Group by date to only write end-of-day balances
        const dailyBalances = {};
        accTxs.forEach(tx => {
            if (tx.source === acc.id) currentBalance -= tx.amount;
            if (tx.destination === acc.id) currentBalance += tx.amount;
            dailyBalances[tx.date] = currentBalance;
        });

        Object.entries(dailyBalances).forEach(([date, bal]) => {
            balanceWrites.push({
                id: `${acc.id}_${date}`,
                data: { account_id: acc.id, date, balance: bal, updated_at: admin.firestore.FieldValue.serverTimestamp() }
            });
        });
    }

    // 4. Commit in chunked batches (500 limit)
    const chunks = chunkArray(balanceWrites, 450); // Use 450 to be safe
    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(op => {
            const ref = db.doc(`users/${userId}/account_balances/${op.id}`);
            batch.set(ref, op.data, { merge: true });
        });
        await batch.commit();
    }

    // 5. Finalize status
    const finalBatch = db.batch();
    targetAccounts.forEach(acc => {
        finalBatch.update(db.doc(`users/${userId}/accounts/${acc.id}`), { 
            balanceDirty: false, 
            updated_at: admin.firestore.FieldValue.serverTimestamp() 
        });
    });
    finalBatch.set(logRef, { eventId, status: 'success', completed_at: admin.firestore.FieldValue.serverTimestamp() });
    await finalBatch.commit();
    
    logger.info(`Recalculation complete for user ${userId}`);
}

exports.onTransactionWrite = onDocumentWritten("users/{userId}/transactions/{txId}", async (event) => {
    const userId = event.params.userId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    await db.runTransaction(async (transaction) => {
        const logRef = db.doc(`users/${userId}/system_logs/${event.id}`);
        const logSnap = await transaction.get(logRef);
        if (logSnap.exists()) return;

        const userRef = db.doc(`users/${userId}`);
        const userSnap = await transaction.get(userRef);
        if (userSnap.exists() && userSnap.data().isImporting) {
            transaction.set(logRef, { eventId: event.id, status: 'skipped_during_import' });
            return;
        }

        const affectedAccountIds = new Set();

        if (before) {
            await calculateBalanceUpdate(transaction, userId, before.source, before.amount, before.date);
            await calculateBalanceUpdate(transaction, userId, before.destination, -before.amount, before.date);
            if (before.source) affectedAccountIds.add(before.source);
            if (before.destination) affectedAccountIds.add(before.destination);
        }
        if (after) {
            await calculateBalanceUpdate(transaction, userId, after.source, -after.amount, after.date);
            await calculateBalanceUpdate(transaction, userId, after.destination, after.amount, after.date);
            if (after.source) affectedAccountIds.add(after.source);
            if (after.destination) affectedAccountIds.add(after.destination);
        }

        affectedAccountIds.forEach(accId => {
            if (accId && accId !== "external") {
                transaction.update(db.doc(`users/${userId}/accounts/${accId}`), { 
                    balanceDirty: false, 
                    updated_at: admin.firestore.FieldValue.serverTimestamp() 
                });
            }
        });

        transaction.set(logRef, { eventId: event.id, status: 'success', completed_at: admin.firestore.FieldValue.serverTimestamp() });
    });
});

exports.onTemplateWrite = onDocumentWritten("users/{userId}/recurringTemplates/{tplId}", async (event) => {
    const userId = event.params.userId;
    const after = event.data.after.data();
    if (after) {
        // Trigger global refresh
        const accountsSnap = await db.collection(`users/${userId}/accounts`).get();
        const ids = accountsSnap.docs.map(d => d.id);
        await recalculateAccounts(userId, ids, event.id);
    }
});

exports.onAccountWrite = onDocumentWritten("users/{userId}/accounts/{accId}", async (event) => {
    const userId = event.params.userId;
    const accId = event.params.accId;
    const after = event.data.after.data();
    const before = event.data.before.data();

    // Trigger refresh only if balanceDirty is explicitly set to true
    if (after && after.balanceDirty === true && (!before || before.balanceDirty !== true)) {
        await recalculateAccounts(userId, [accId], event.id);
    }
});
