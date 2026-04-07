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
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from "./auth.js";
import { generateId, getMonthKey, generateDeterministicTransactionId, generateDeterministicTemplateId } from "./utils.js";
import { saveDataToCache } from "./storage.js";
import { getFunctionalBoundaryDate } from './state.js';

const db = getFirestore();
let unsubscribes = [];

export const unsubscribeFromData = () => {
    unsubscribes.forEach(unsub => unsub());
    unsubscribes = [];
};

export const subscribeToAppData = (userId, onDataUpdate) => {
    unsubscribeFromData();
    if (!userId) return;

    let initialLoadsPending = 6;
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
        recurringTemplates: [],
        monthSelectorConfig: {
            startDate: `${new Date().getFullYear()}-01-01`,
            endDate: getFunctionalBoundaryDate(),
            step: 'month'
        }
    };

    const triggerUpdate = () => {
        onDataUpdate({ ...localState });
        saveDataToCache(userId, localState);
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

    const recUnsub = onSnapshot(collection(db, `users/${userId}/recurringTemplates`), (snapshot) => {
        localState.recurringTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    unsubscribes.push(accUnsub, catUnsub, txUnsub, monthsUnsub, recUnsub);
};

export const addAccountToFirestore = async (userId, account) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    await setDoc(docRef, { ...account, updated_at: serverTimestamp() });
    recalculateAndStoreBalances(userId, account.initialBalanceDate);
};

export const updateAccountInFirestore = async (userId, account) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Document does not exist!");
        transaction.update(docRef, { ...account, updated_at: serverTimestamp() });
    });
    recalculateAndStoreBalances(userId, account.initialBalanceDate);
};

export const deleteAccountFromFirestore = async (userId, accountId) => {
    const docRef = doc(db, `users/${userId}/accounts`, accountId);
    await deleteDoc(docRef);
    recalculateAndStoreBalances(userId); // Full recalc for safety on delete
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
    recalculateAndStoreBalances(userId, tx.date);
};

export const deleteTransactionFromFirestore = async (userId, txId) => {
    const docRef = doc(db, `users/${userId}/transactions`, txId);
    const docSnap = await getDoc(docRef);
    const txDate = docSnap.exists() ? docSnap.data().date : null;
    await deleteDoc(docRef);
    recalculateAndStoreBalances(userId, txDate);
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

    const startDate = new Date(template.date + 'T00:00:00Z');
    const boundaryDate = new Date(Date.UTC(startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate() - 1));
    const boundaryDateStr = boundaryDate.toISOString().split('T')[0];

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
    recalculateAndStoreBalances(userId, template.date);
};

export const updateSingleTransactionInFirestore = async (userId, oldTxId, newTxData) => {
    const newTxId = generateDeterministicTransactionId(newTxData);
    const batch = writeBatch(db);

    if (newTxId !== oldTxId) {
        const oldTxRef = doc(db, `users/${userId}/transactions`, oldTxId);
        batch.delete(oldTxRef);
    }
    
    const newTxRef = doc(db, `users/${userId}/transactions`, newTxId);
    batch.set(newTxRef, {
        id: newTxId,
        ...newTxData,
        updated_at: serverTimestamp()
    });
    
    await batch.commit();
    recalculateAndStoreBalances(userId, newTxData.date);
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
    
    const startDate = new Date(newTemplate.date + 'T00:00:00Z');
    const boundaryDate = new Date(Date.UTC(startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate() - 1));
    const boundaryDateStr = boundaryDate.toISOString().split('T')[0];

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
    recalculateAndStoreBalances(userId, newTemplate.date);
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
    recalculateAndStoreBalances(userId, templateDate);
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
        commitNeeded = true;
    }
    
    if (commitNeeded && opsCount > 0) {
        await batch.commit();
    }
};

export const importDataToFirestore = async (userId, accounts, transactions, templates, categories) => {
    const promises = [];
    if (accounts) {
        accounts.forEach(acc => promises.push(setDoc(doc(db, `users/${userId}/accounts`, acc.id), { ...acc, updated_at: serverTimestamp() })));
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
    recalculateAndStoreBalances(userId); 
};

export const updateSettingsInFirestore = async (userId, settingsId, data) => {
    const docRef = doc(db, `users/${userId}/settings`, settingsId);
    await setDoc(docRef, { ...data, updated_at: serverTimestamp() });
};

/**
 * Recalculates all account balances month by month and stores them in the 'months' collection.
 * @param {string} userId
 * @param {string} [startDateStr] - Optional starting date (YYYY-MM-DD). If not provided, recalculates from the beginning.
 */
export const recalculateAndStoreBalances = async (userId, startDateStr) => {
    if (!userId) return;

    try {
        const boundaryDateStr = getFunctionalBoundaryDate();
        
        const accountsSnap = await getDocs(collection(db, `users/${userId}/accounts`));
        const transactionsSnap = await getDocs(collection(db, `users/${userId}/transactions`));
        
        const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (accounts.length === 0) return;

        transactions.sort((a, b) => a.date.localeCompare(b.date));
        
        const currentBalances = {};
        let calculationStartMonthKey;

        if (startDateStr) {
            calculationStartMonthKey = startDateStr.substring(0, 7);
            const prevMonthDate = new Date(startDateStr.substring(0, 7) + '-01T00:00:00Z');
            prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
            const prevMonthKey = prevMonthDate.toISOString().substring(0, 7);
            
            const prevMonthSnap = await getDoc(doc(db, `users/${userId}/months`, prevMonthKey));
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

        while (current <= end) {
            const monthKey = current.toISOString().substring(0, 7);
            
            (txByMonth[monthKey] || []).forEach(tx => {
                if (tx.source && currentBalances[tx.source] !== undefined) {
                    currentBalances[tx.source] -= tx.amount;
                }
                if (tx.destination && currentBalances[tx.destination] !== undefined) {
                    currentBalances[tx.destination] += tx.amount;
                }
            });
            
            monthlyBalances[monthKey] = { ...currentBalances };
            current.setUTCMonth(current.getUTCMonth() + 1);
        }

        const batch = writeBatch(db);
        for (const [monthKey, balances] of Object.entries(monthlyBalances)) {
            const docRef = doc(db, `users/${userId}/months`, monthKey);
            batch.set(docRef, { balances, updated_at: serverTimestamp() }, { merge: true });
        }
        await batch.commit();
        console.log(`Balances recalculated and stored from ${calculationStartMonthKey} to ${boundaryDateStr.substring(0, 7)}.`);
    } catch (error) {
        console.error("Error recalculating balances:", error);
    }
};
