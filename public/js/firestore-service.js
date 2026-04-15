import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    runTransaction, 
    writeBatch, 
    serverTimestamp,
    query,
    where,
    getDocs,
    getDoc,
    updateDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from "./auth.js";
import { generateId, getMonthKey, generateDeterministicTransactionId, generateDeterministicTemplateId } from "./utils.js";
import { getFunctionalBoundaryDate } from './state.js';

export const db = getFirestore();
let unsubscribes = [];

export const unsubscribeFromData = () => {
    unsubscribes.forEach(unsub => unsub());
    unsubscribes = [];
};

export const subscribeToAppData = (userId, onDataUpdate) => {
    unsubscribeFromData();
    if (!userId) return;

    let initialLoadsPending = 7;
    const onInitialLoadComplete = () => {
        initialLoadsPending--;
        if (initialLoadsPending === 0) {
            triggerUpdate();
        }
    };

    let localState = {
        accounts: [],
        categories: [],
        transactions: [],
        months: {},
        accountBalances: {},
        recurringTemplates: [],
        monthSelectorConfig: {
            startDate: `${new Date().getFullYear()}-01-01`,
            endDate: getFunctionalBoundaryDate(),
            step: 'month'
        }
    };

    const triggerUpdate = () => {
        onDataUpdate({ ...localState });
    };

    const settingsUnsub = onSnapshot(doc(db, `users/${userId}/settings`, 'monthSelector'), (docSnap) => {
        if (docSnap.exists()) {
            localState.monthSelectorConfig = docSnap.data();
        }
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const accUnsub = onSnapshot(collection(db, `users/${userId}/accounts`), (snapshot) => {
        localState.accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const catUnsub = onSnapshot(collection(db, `users/${userId}/categories`), (snapshot) => {
        localState.categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const txUnsub = onSnapshot(collection(db, `users/${userId}/transactions`), (snapshot) => {
        localState.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const monthsUnsub = onSnapshot(collection(db, `users/${userId}/months`), (snapshot) => {
        localState.months = {};
        snapshot.docs.forEach(doc => { localState.months[doc.id] = doc.data(); });
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const balUnsub = onSnapshot(collection(db, `users/${userId}/account_balances`), (snapshot) => {
        localState.accountBalances = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Store with full date as per new requirement
            const key = `${data.account_id}_${data.date}`;
            localState.accountBalances[key] = data.balance;
        });
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const recUnsub = onSnapshot(collection(db, `users/${userId}/recurringTemplates`), (snapshot) => {
        localState.recurringTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    unsubscribes.push(accUnsub, catUnsub, txUnsub, monthsUnsub, balUnsub, recUnsub);
};

export const addAccountToFirestore = async (userId, account) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    const createDate = account.createDate || account.initialBalanceDate;
    
    // STRICT: Only allowed fields
    const accountData = { 
        id: account.id,
        name: account.name,
        createDate: createDate,
        isSaving: !!account.isSaving,
        balanceDirty: false,
        updated_at: serverTimestamp() 
    };
    
    // Use overwrite (setDoc without merge) to wipe any old fields
    await setDoc(docRef, accountData);

    // 2. Store balance in separate collection
    const balDocId = `${account.id}_${createDate}`;
    const balRef = doc(db, `users/${userId}/account_balances`, balDocId);
    await setDoc(balRef, {
        account_id: account.id,
        date: createDate,
        balance: account.initialBalance || 0,
        updated_at: serverTimestamp()
    });
};

export const updateAccountInFirestore = async (userId, account, oldInitialBalance) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    const createDate = account.createDate || account.initialBalanceDate;
    
    const delta = account.initialBalance - oldInitialBalance;
    let balanceDocs = [];
    if (delta !== 0) {
        const q = query(collection(db, `users/${userId}/account_balances`), where("account_id", "==", account.id));
        const snapshot = await getDocs(q);
        balanceDocs = snapshot.docs.map(d => ({ ref: d.ref, balance: d.data().balance }));
    }

    await markAccountsBalanceDirty(userId, [account.id]);

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Document does not exist!");
        
        const oldData = docSnap.data();
        
        // STRICT: Only allowed fields
        const accountData = { 
            id: account.id,
            name: account.name,
            createDate: createDate || oldData.createDate,
            isSaving: !!account.isSaving,
            updated_at: serverTimestamp() 
        };

        if (oldData.createDate !== accountData.createDate) {
            const oldBalDocId = `${account.id}_${oldData.createDate}`;
            const newBalDocId = `${account.id}_${accountData.createDate}`;
            transaction.delete(doc(db, `users/${userId}/account_balances`, oldBalDocId));
            transaction.set(doc(db, `users/${userId}/account_balances`, newBalDocId), {
                account_id: account.id,
                date: accountData.createDate,
                balance: account.initialBalance || 0,
                updated_at: serverTimestamp()
            });
        } else if (delta !== 0) {
            balanceDocs.forEach(balDoc => {
                transaction.update(balDoc.ref, {
                    balance: balDoc.balance + delta,
                    updated_at: serverTimestamp()
                });
            });
        }

        // FORCE overwrite to remove fields like initialBalance/InitialBalance
        transaction.set(docRef, { ...accountData, balanceDirty: false });
    });
};

export const deleteAccountFromFirestore = async (userId, accountId) => {
    // 1. Delete the account document
    const docRef = doc(db, `users/${userId}/accounts`, accountId);
    await deleteDoc(docRef);

    // 2. Delete all associated account balances
    const q = query(collection(db, `users/${userId}/account_balances`), where("account_id", "==", accountId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

export const addCategoryToFirestore = async (userId, category) => {
    const docRef = doc(db, `users/${userId}/categories`, category.id);
    await setDoc(docRef, { ...category, updated_at: serverTimestamp() });
};

export const updateCategoryInFirestore = async (userId, category) => {
    const docRef = doc(db, `users/${userId}/categories`, category.id);
    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Document does not exist!");
        transaction.update(docRef, { ...category, updated_at: serverTimestamp() });
    });
};

export const deleteCategoryFromFirestore = async (userId, categoryId) => {
    const docRef = doc(db, `users/${userId}/categories`, categoryId);
    await deleteDoc(docRef);
};

export const updateCategoryOrderInFirestore = async (userId, updates) => {
    const batch = writeBatch(db);
    updates.forEach(update => {
        const docRef = doc(db, `users/${userId}/categories`, update.id);
        batch.update(docRef, { 'index-order': update['index-order'], updated_at: serverTimestamp() });
    });
    await batch.commit();
};


// -- TRANSACTIONS --
export const addTransactionToFirestore = async (userId, tx) => {
    const docRef = doc(db, `users/${userId}/transactions`, tx.id);
    await setDoc(docRef, { ...tx, updated_at: serverTimestamp() });
    
    // Surgical delta updates
    if (tx.source && tx.source !== 'external') {
        await markSingleAccountBalanceDelta(userId, tx.source, -tx.amount, tx.date);
    }
    if (tx.destination && tx.destination !== 'external') {
        await markSingleAccountBalanceDelta(userId, tx.destination, tx.amount, tx.date);
    }
};

export const deleteTransactionFromFirestore = async (userId, txId) => {
    const docRef = doc(db, `users/${userId}/transactions`, txId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const tx = docSnap.data();
        await deleteDoc(docRef);
        
        // Surgical delta updates (inverse of original transaction)
        if (tx.source && tx.source !== 'external') {
            await markSingleAccountBalanceDelta(userId, tx.source, tx.amount, tx.date);
        }
        if (tx.destination && tx.destination !== 'external') {
            await markSingleAccountBalanceDelta(userId, tx.destination, -tx.amount, tx.date);
        }
    } else {
        await deleteDoc(docRef);
    }
};

// -- MONTHS --
export const updateMonthStatus = async (userId, monthKey, status) => {
    const docRef = doc(db, `users/${userId}/months`, monthKey);
    await setDoc(docRef, { status, updated_at: serverTimestamp() }, { merge: true });
};

// -- RECURRING TRANSACTIONS (NEW BATCH-BASED APPROACH) --

const calculateAllOccurrences = (template) => {
    const occurrences = [];
    let current = new Date(template.date + 'T00:00:00Z');
    const endDate = new Date(template.endDate + 'T23:59:59Z');
    const anchorDay = current.getUTCDate();

    while (current <= endDate) {
        occurrences.push(current.toISOString().split('T')[0]);

        switch (template.periodicity) {
            case 'M':
                current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, anchorDay));
                if (current.getUTCDate() !== anchorDay) {
                    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0));
                }
                break;
            case 'Q':
                current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 3, anchorDay));
                if (current.getUTCDate() !== anchorDay) {
                    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0));
                }
                break;
            case 'Y':
                current = new Date(Date.UTC(current.getUTCFullYear() + 1, current.getUTCMonth(), anchorDay));
                break;
            default:
                return occurrences; 
        }
    }
    return occurrences;
};


const batchGenerateAndSaveTransactions = (batch, userId, template) => {
    const dates = calculateAllOccurrences(template);

    for (const date of dates) {
        const txData = {
            label: template.label,
            amount: template.amount,
            date: date,
            Category: template.category,
            source: template.source,
            destination: template.destination,
            Model: template.id,
        };
        const txId = generateDeterministicTransactionId(txData);
        const txRef = doc(db, `users/${userId}/transactions`, txId);
        batch.set(txRef, {
            id: txId,
            ...txData,
            updated_at: serverTimestamp()
        });
    }
};

export const addRecurringTemplate = async (userId, template) => {
    const batch = writeBatch(db);

    const boundaryDateStr = getFunctionalBoundaryDate();

    const generationTemplate = { ...template };

    if (!template.endDate) {
        generationTemplate.endDate = boundaryDateStr;
        template.endDate = null;
    } else {
        generationTemplate.endDate = template.endDate > boundaryDateStr ? boundaryDateStr : template.endDate;
    }
    
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, template.id);
    batch.set(templateRef, { 
        ...template, 
        updated_at: serverTimestamp() 
    });

    batchGenerateAndSaveTransactions(batch, userId, generationTemplate);

    await batch.commit();
    await markAccountsBalanceDirty(userId, [template.source, template.destination].filter(id => id && id !== 'external'));
};

export const updateSingleTransactionInFirestore = async (userId, oldTxId, newTxData) => {
    // 1. Get old transaction to reverse its impact
    const oldTxRef = doc(db, `users/${userId}/transactions`, oldTxId);
    const oldSnap = await getDoc(oldTxRef);
    if (oldSnap.exists()) {
        const oldTx = oldSnap.data();
        if (oldTx.source && oldTx.source !== 'external') {
            await markSingleAccountBalanceDelta(userId, oldTx.source, oldTx.amount, oldTx.date);
        }
        if (oldTx.destination && oldTx.destination !== 'external') {
            await markSingleAccountBalanceDelta(userId, oldTx.destination, -oldTx.amount, oldTx.date);
        }
        await deleteDoc(oldTxRef);
    }

    // 2. Create new transaction and apply its impact
    const newTxId = generateDeterministicTransactionId(newTxData);
    const newTxRef = doc(db, `users/${userId}/transactions`, newTxId);
    await setDoc(newTxRef, {
        id: newTxId,
        ...newTxData,
        updated_at: serverTimestamp()
    });
    
    if (newTxData.source && newTxData.source !== 'external') {
        await markSingleAccountBalanceDelta(userId, newTxData.source, -newTxData.amount, newTxData.date);
    }
    if (newTxData.destination && newTxData.destination !== 'external') {
        await markSingleAccountBalanceDelta(userId, newTxData.destination, newTxData.amount, newTxData.date);
    }
};

export const updateRecurringSeriesInFirestore = async (userId, oldTemplateId, newTemplateValues) => {
    const batch = writeBatch(db);
    
    const newTemplateId = generateDeterministicTemplateId({
        ...newTemplateValues,
        category: newTemplateValues.category || newTemplateValues.Category
    });

    if (newTemplateId !== oldTemplateId) {
        const oldTemplateRef = doc(db, `users/${userId}/recurringTemplates`, oldTemplateId);
        batch.delete(oldTemplateRef);
    }
    
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("Model", "==", oldTemplateId)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    const newTemplate = { 
        ...newTemplateValues,
        id: newTemplateId,
    };
    
    const boundaryDateStr = getFunctionalBoundaryDate();

    const generationTemplate = { ...newTemplate };

    if (!newTemplate.endDate) {
        generationTemplate.endDate = boundaryDateStr;
        newTemplate.endDate = null;
    } else {
        generationTemplate.endDate = newTemplate.endDate > boundaryDateStr ? boundaryDateStr : newTemplate.endDate;
    }

    const newTemplateRef = doc(db, `users/${userId}/recurringTemplates`, newTemplateId);
    batch.set(newTemplateRef, {
        ...newTemplate, 
        updated_at: serverTimestamp()
    });
    
    batchGenerateAndSaveTransactions(batch, userId, generationTemplate);

    await batch.commit();
    await markAccountsBalanceDirty(userId); // Mark all for safety with templates
};

export const deleteRecurringSeriesInFirestore = async (userId, templateId) => {
    const batch = writeBatch(db);
    
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, templateId);
    const templateSnap = await getDoc(templateRef);
    const templateDate = templateSnap.exists() ? templateSnap.data().date : null;

    batch.delete(templateRef);
    
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("Model", "==", templateId)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    await markAccountsBalanceDirty(userId); // Mark all for safety
};

export const resetDataInFirestore = async (userId, deleteAccounts, deleteTransactions) => {
    const batch = writeBatch(db);
    let commitNeeded = false;
    let opsCount = 0;
    
    if (deleteTransactions) {
        const txSnap = await getDocs(collection(db, `users/${userId}/transactions`));
        txSnap.forEach(docSnap => { batch.delete(docSnap.ref); opsCount++; });
        const moSnap = await getDocs(collection(db, `users/${userId}/months`));
        moSnap.forEach(docSnap => { batch.delete(docSnap.ref); opsCount++; });
        const recSnap = await getDocs(collection(db, `users/${userId}/recurringTemplates`));
        recSnap.forEach(docSnap => { batch.delete(docSnap.ref); opsCount++; });
        commitNeeded = true;
    }
    
    if (deleteAccounts) {
        const accSnap = await getDocs(collection(db, `users/${userId}/accounts`));
        accSnap.forEach(docSnap => { batch.delete(docSnap.ref); opsCount++; });
        
        const balSnap = await getDocs(collection(db, `users/${userId}/account_balances`));
        balSnap.forEach(docSnap => { batch.delete(docSnap.ref); opsCount++; });
        
        commitNeeded = true;
    }
    
    if (commitNeeded && opsCount > 0) {
        await batch.commit();
    }
};

export const importDataToFirestore = async (userId, accounts, transactions, templates, categories) => {
    const promises = [];
    if (accounts) {
        accounts.forEach(acc => {
            const createDate = acc.createDate || acc.initialBalanceDate;
            
            // 1. Save Account strictly with required fields
            promises.push(setDoc(doc(db, `users/${userId}/accounts`, acc.id), { 
                id: acc.id,
                name: acc.name,
                createDate: createDate,
                isSaving: !!acc.isSaving,
                balanceDirty: false,
                updated_at: serverTimestamp() 
            }));

            // 2. Save first balance record
            const balDocId = `${acc.id}_${createDate}`;
            promises.push(setDoc(doc(db, `users/${userId}/account_balances`, balDocId), {
                account_id: acc.id,
                date: createDate,
                balance: acc.initialBalance || 0,
                updated_at: serverTimestamp()
            }));
        });
    }
    if (transactions) {
        transactions.forEach(tx => promises.push(setDoc(doc(db, `users/${userId}/transactions`, tx.id), { ...tx, updated_at: serverTimestamp() })));
    }
    if (templates) {
        templates.forEach(rec => promises.push(setDoc(doc(db, `users/${userId}/recurringTemplates`, rec.id), { ...rec, updated_at: serverTimestamp() })));
    }
    if (categories) {
        categories.forEach(cat => promises.push(setDoc(doc(db, `users/${userId}/categories`, cat.id), { ...cat, updated_at: serverTimestamp() })));
    }
    await Promise.all(promises);
    await markAccountsBalanceDirty(userId); 
};

export const updateSettingsInFirestore = async (userId, settingsId, data) => {
    const docRef = doc(db, `users/${userId}/settings`, settingsId);
    await setDoc(docRef, { ...data, updated_at: serverTimestamp() });
};

export const setUserImportingState = async (userId, isImporting) => {
    if (!userId) return;
    const userRef = doc(db, `users/${userId}`);
    await setDoc(userRef, { isImporting, updated_at: serverTimestamp() }, { merge: true });
};

import { calculateBalanceDelta, sweepAccountBalances } from "./balance-engine.js";

/**
 * Triggers a balance refresh. 
 * Falls back to main-thread execution if Service Worker is not yet controlling the page.
 * @param {string} userId 
 * @param {'SWEEP'|'DELTA'} action 
 * @param {Object} data 
 */
const triggerSWRefresh = async (userId, action, data) => {
    console.log(`[FirestoreService] Triggering balance ${action} for accounts:`, data.accountId || data.accountIds);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'REFRESH_BALANCES',
            payload: { userId, action, data }
        });
    } else {
        // Fallback: Perform in main thread
        console.log(`SW not ready, performing ${action} in main thread...`);
        try {
            if (action === 'DELTA') {
                await calculateBalanceDelta(
                    db, userId, data.accountId, data.amount, data.date,
                    getDocs, updateDoc, setDoc, doc, collection, query, where, orderBy, limit, serverTimestamp
                );
            } else if (action === 'SWEEP') {
                await sweepAccountBalances(
                    db, userId, data.accountIds,
                    getDocs, setDoc, updateDoc, doc, collection, query, where, orderBy, limit, serverTimestamp
                );
            }
            
            // Manually clear the dirty flag since we did it in the main thread
            const batch = writeBatch(db);
            const targets = action === 'DELTA' ? [data.accountId] : data.accountIds;
            targets.forEach(id => {
                const accRef = doc(db, `users/${userId}/accounts`, id);
                batch.update(accRef, { balanceDirty: false, updated_at: serverTimestamp() });
            });
            await batch.commit();

            console.log(`${action} complete (main thread).`);
        } catch (error) {
            console.error(`Main thread balance refresh error (${action}):`, error);
        }
    }
};

/**
 * Marks accounts as dirty and requests a refresh from the Service Worker.
 */
export const markAccountsBalanceDirty = async (userId, accountIds) => {
    if (!userId) return;

    try {
        let targets = accountIds;
        if (!targets) {
            const accountsSnap = await getDocs(collection(db, `users/${userId}/accounts`));
            targets = accountsSnap.docs.map(d => d.id);
        }

        if (targets.length === 0) return;

        const batch = writeBatch(db);
        targets.forEach(id => {
            const accRef = doc(db, `users/${userId}/accounts`, id);
            batch.update(accRef, { balanceDirty: true, updated_at: serverTimestamp() });
        });
        await batch.commit();

        // Delegate the actual calculation to the Service Worker
        triggerSWRefresh(userId, 'SWEEP', { accountIds: targets });
        
    } catch (error) {
        console.error("Error triggering balance refresh:", error);
    }
};

export const markSingleAccountBalanceDelta = async (userId, accountId, amount, date) => {
    if (!userId || !accountId || accountId === 'external' || amount === 0) return;
    
    // 1. UI feedback: mark as dirty
    const accRef = doc(db, `users/${userId}/accounts`, accountId);
    await setDoc(accRef, { balanceDirty: true, updated_at: serverTimestamp() }, { merge: true });

    // 2. Delegate surgical delta to SW
    triggerSWRefresh(userId, 'DELTA', { accountId, amount, date });
};

