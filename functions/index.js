const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Shared logic to recalculate balances for a user's accounts starting from a specific date.
 */
async function recalculateBalances(userId, startDateStr, eventId) {
    // Idempotency check
    const logRef = db.doc(`users/${userId}/system_logs/${eventId}`);
    
    try {
        await db.runTransaction(async (transaction) => {
            const logSnap = await transaction.get(logRef);
            if (logSnap.exists()) {
                logger.info(`Event ${eventId} already processed for user ${userId}. Skipping.`);
                return;
            }

            // 1. Get functional boundary date
            const year = new Date().getFullYear();
            const boundaryDateStr = `${year + 3}-12-31`;

            // 2. Fetch accounts and transactions
            const accountsSnap = await transaction.get(db.collection(`users/${userId}/accounts`));
            const transactionsSnap = await transaction.get(db.collection(`users/${userId}/transactions`));

            const accounts = [];
            accountsSnap.forEach(doc => accounts.push({ id: doc.id, ...doc.data() }));
            
            const transactions = [];
            transactionsSnap.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));

            if (accounts.length === 0) return;

            // Sort transactions by date
            transactions.sort((a, b) => a.date.localeCompare(b.date));

            const currentBalances = {};
            let calculationStartMonthKey;

            // 3. Determine starting point
            if (startDateStr) {
                calculationStartMonthKey = startDateStr.substring(0, 7);
                const prevMonthDate = new Date(startDateStr.substring(0, 7) + '-01T00:00:00Z');
                prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
                const prevMonthKey = prevMonthDate.toISOString().substring(0, 7);
                
                const prevMonthRef = db.doc(`users/${userId}/months/${prevMonthKey}`);
                const prevMonthSnap = await transaction.get(prevMonthRef);
                
                if (prevMonthSnap.exists()) {
                    Object.assign(currentBalances, prevMonthSnap.data().balances);
                } else {
                    calculationStartMonthKey = null;
                }
            }

            if (!calculationStartMonthKey) {
                let minDateStr = accounts.reduce((min, acc) => (acc.initialBalanceDate < min ? acc.initialBalanceDate : min), '9999-12-31');
                calculationStartMonthKey = minDateStr.substring(0, 7);
                
                accounts.forEach(acc => {
                    currentBalances[acc.id] = acc.initialBalance || 0;
                });
            }

            const txByMonth = {};
            transactions.forEach(tx => {
                const monthKey = tx.date.substring(0, 7);
                if (!txByMonth[monthKey]) txByMonth[monthKey] = [];
                txByMonth[monthKey].push(tx);
            });

            const monthlyBalances = {};
            let current = new Date(calculationStartMonthKey + '-01T00:00:00Z');
            const end = new Date(boundaryDateStr.substring(0, 7) + '-01T00:00:00Z');

            // 4. Iteratively calculate balances
            while (current <= end) {
                const monthKey = current.toISOString().substring(0, 7);
                
                (txByMonth[monthKey] || []).forEach(tx => {
                    // Ignore external accounts (empty or "external")
                    if (tx.source && tx.source !== "external" && currentBalances[tx.source] !== undefined) {
                        currentBalances[tx.source] -= tx.amount;
                    }
                    if (tx.destination && tx.destination !== "external" && currentBalances[tx.destination] !== undefined) {
                        currentBalances[tx.destination] += tx.amount;
                    }
                });
                
                monthlyBalances[monthKey] = { ...currentBalances };
                current.setUTCMonth(current.getUTCMonth() + 1);
            }

            // 5. Atomic Batch Update for all months
            const batch = db.batch();
            for (const [monthKey, balances] of Object.entries(monthlyBalances)) {
                const monthRef = db.doc(`users/${userId}/months/${monthKey}`);
                batch.set(monthRef, { balances, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }

            // 6. Clear balanceDirty flag for ALL accounts (as we recalculated everything for simplicity)
            accounts.forEach(acc => {
                const accRef = db.doc(`users/${userId}/accounts/${acc.id}`);
                batch.update(accRef, { balanceDirty: false, updated_at: admin.firestore.FieldValue.serverTimestamp() });
            });

            // 7. Audit Log
            batch.set(logRef, {
                userId,
                eventId,
                startDate: startDateStr || 'beginning',
                completed_at: admin.firestore.FieldValue.serverTimestamp(),
                status: 'success'
            });

            await batch.commit();
            logger.info(`Balance recalculation successful for user ${userId} starting from ${startDateStr}.`);
        });
    } catch (error) {
        logger.error(`Error recalculating balances for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Triggered on any transaction write (create, update, delete)
 */
exports.onTransactionWrite = onDocumentWritten("users/{userId}/transactions/{txId}", async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Determine the earliest date involved
    let earliestDate = null;
    if (beforeData && beforeData.date) earliestDate = beforeData.date;
    if (afterData && afterData.date) {
        if (!earliestDate || afterData.date < earliestDate) earliestDate = afterData.date;
    }

    if (!earliestDate) {
        logger.warn(`No date found for transaction event ${event.id}.`);
        return;
    }

    await recalculateBalances(userId, earliestDate, event.id);
});

/**
 * Triggered on any recurring template write (create, update, delete)
 */
exports.onTemplateWrite = onDocumentWritten("users/{userId}/recurringTemplates/{tplId}", async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Recurring templates generate many transactions, so we start from the template date
    let earliestDate = null;
    if (beforeData && beforeData.date) earliestDate = beforeData.date;
    if (afterData && afterData.date) {
        if (!earliestDate || afterData.date < earliestDate) earliestDate = afterData.date;
    }

    if (!earliestDate) {
        logger.warn(`No date found for template event ${event.id}.`);
        return;
    }

    await recalculateBalances(userId, earliestDate, event.id);
});

/**
 * Triggered on any account write to handle explicit refresh requests via balanceDirty: true
 */
exports.onAccountWrite = onDocumentWritten("users/{userId}/accounts/{accId}", async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Only trigger if balanceDirty changed to true (or was already true and didn't change, for safety)
    if (afterData && afterData.balanceDirty === true && (!beforeData || beforeData.balanceDirty !== true)) {
        logger.info(`Explicit balance refresh requested for user ${userId} via account ${event.params.accId}.`);
        // When triggered via account, we recalculate from the beginning of that account's history (or just everything for simplicity)
        await recalculateBalances(userId, null, event.id);
    }
});
