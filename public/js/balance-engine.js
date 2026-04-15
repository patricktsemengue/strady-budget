import { getMonthFromDate } from "./utils.js";

export const getFunctionalBoundaryDateStr = () => {
    const year = new Date().getFullYear();
    return `${year + 3}-12-31`;
};

/**
 * Calculates the surgical impact of a single amount change on an account's timeline.
 */
export async function calculateBalanceDelta(db, userId, accountId, amount, balanceDate, getDocs, updateDoc, setDoc, doc, collection, query, where, orderBy, limit, serverTimestamp) {
    if (!accountId || accountId === "external" || accountId === "") return;

    const balancesColl = collection(db, `users/${userId}/account_balances`);
    const q = query(balancesColl, where("account_id", "==", accountId), where("date", ">=", balanceDate));
    
    const snapshot = await getDocs(q);
    let exactMatch = false;

    // Update all existing future records
    const updates = [];
    snapshot.forEach(balDoc => {
        const data = balDoc.data();
        if (data.date === balanceDate) exactMatch = true;
        updates.push(updateDoc(balDoc.ref, {
            balance: data.balance + amount,
            updated_at: serverTimestamp()
        }));
    });

    if (!exactMatch) {
        // Create the record for the specific transaction date if it doesn't exist
        const prevQ = query(balancesColl, where("account_id", "==", accountId), where("date", "<", balanceDate), orderBy("date", "desc"), limit(1));
        const prevSnap = await getDocs(prevQ);
        
        let baseBalance = 0;
        if (!prevSnap.empty) {
            baseBalance = prevSnap.docs[0].data().balance;
        } else {
            const accSnap = await getDocs(doc(db, `users/${userId}/accounts`, accountId));
            // Note: Since initialBalance is dropped, we rely on the creation record in account_balances.
            // If not found, it starts at 0.
        }

        const balDocId = `${accountId}_${balanceDate}`;
        const month = getMonthFromDate(balanceDate);
        updates.push(setDoc(doc(db, `users/${userId}/account_balances`, balDocId), {
            account_id: accountId,
            date: balanceDate,
            month,
            balance: baseBalance + amount,
            updated_at: serverTimestamp()
        }));
    }

    await Promise.all(updates);
}

/**
 * Performs a full chronological sweep for one or more accounts.
 */
export async function sweepAccountBalances(db, userId, accountIds, getDocs, setDoc, updateDoc, doc, collection, query, where, orderBy, limit, serverTimestamp) {
    if (!accountIds || accountIds.length === 0) return;

    const accountsSnap = await getDocs(collection(db, `users/${userId}/accounts`));
    const transactionsSnap = await getDocs(collection(db, `users/${userId}/transactions`));

    const allAccounts = [];
    accountsSnap.forEach(d => allAccounts.push({ id: d.id, ...d.data() }));
    const targetAccounts = allAccounts.filter(a => accountIds.includes(a.id));

    const allTransactions = [];
    transactionsSnap.forEach(d => allTransactions.push({ id: d.id, ...d.data() }));
    allTransactions.sort((a, b) => a.date.localeCompare(b.date));

    const batchPromises = [];

    const boundaryDate = getFunctionalBoundaryDateStr();

    for (const acc of targetAccounts) {
        // 1. Find the very first balance record (The Genesis)
        const balQ = query(collection(db, `users/${userId}/account_balances`), where("account_id", "==", acc.id), orderBy("date", "asc"), limit(1));
        const firstBalSnap = await getDocs(balQ);
        if (firstBalSnap.empty) continue;

        let currentBalance = firstBalSnap.docs[0].data().balance;
        const genesisDate = firstBalSnap.docs[0].data().date;

        const accTxs = allTransactions.filter(t => (t.source === acc.id || t.destination === acc.id) && t.date > genesisDate);
        
        // 2. Project forward
        const dailyBalances = {};
        
        // Ensure projection to boundary date even if no transactions exist
        dailyBalances[genesisDate] = currentBalance;

        accTxs.forEach(tx => {
            if (tx.source === acc.id) currentBalance -= tx.amount;
            if (tx.destination === acc.id) currentBalance += tx.amount;
            dailyBalances[tx.date] = currentBalance;
        });

        // Add boundary date to ensure lookup finds it for any month in the range
        dailyBalances[boundaryDate] = currentBalance;

        // 3. Write updates
        Object.entries(dailyBalances).forEach(([date, bal]) => {
            const balDocId = `${acc.id}_${date}`;
            const month = getMonthFromDate(date);
            batchPromises.push(setDoc(doc(db, `users/${userId}/account_balances`, balDocId), {
                account_id: acc.id,
                date,
                month,
                balance: bal,
                updated_at: serverTimestamp()
            }, { merge: true }));
        });
    }

    await Promise.all(batchPromises);
}
