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
            endDate: `${new Date().getFullYear()}-12-31`,
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

// ... (Account, Category functions remain the same)
export const addAccountToFirestore = async (userId, account) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    await setDoc(docRef, { ...account, updated_at: serverTimestamp() });
};

export const updateAccountInFirestore = async (userId, account) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Document does not exist!");
        transaction.update(docRef, { ...account, updated_at: serverTimestamp() });
    });
};

export const deleteAccountFromFirestore = async (userId, accountId) => {
    const docRef = doc(db, `users/${userId}/accounts`, accountId);
    await deleteDoc(docRef);
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
};

export const deleteTransactionFromFirestore = async (userId, txId) => {
    const docRef = doc(db, `users/${userId}/transactions`, txId);
    await deleteDoc(docRef);
};

// -- MONTHS --
export const updateMonthStatus = async (userId, monthKey, status) => {
    const docRef = doc(db, `users/${userId}/months`, monthKey);
    await setDoc(docRef, { status, updated_at: serverTimestamp() }, { merge: true });
};

// -- RECURRING TRANSACTIONS (NEW BATCH-BASED APPROACH) --

/**
 * Calculates all occurrence dates for a recurring template based on its periodicity.
 * @param {object} template - The recurring template object.
 * @returns {string[]} An array of dates in YYYY-MM-DD format.
 */
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


/**
 * Generates and saves all transaction instances for a given template.
 * @param {WriteBatch} batch - The Firestore WriteBatch to add operations to.
 * @param {string} userId - The user's ID.
 * @param {object} template - The recurring template object.
 */
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
    // Boundary of 36 months
    const boundaryDate = new Date(Date.UTC(startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate() - 1));
    const boundaryDateStr = boundaryDate.toISOString().split('T')[0];

    const generationTemplate = { ...template };

    if (!template.endDate) {
        // Case: User did NOT edit endDate -> Store as NULL, generate up to boundary
        generationTemplate.endDate = boundaryDateStr;
        template.endDate = null;
    } else {
        // Case: User HAS edited endDate -> Store as edited, generate up to MIN(edited, boundary)
        generationTemplate.endDate = template.endDate > boundaryDateStr ? boundaryDateStr : template.endDate;
    }
    
    // 1. Save the original template itself
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, template.id);
    batch.set(templateRef, { 
        ...template, 
        updated_at: serverTimestamp() 
    });

    // 2. Generate and save child transactions using the template with the boundary.
    batchGenerateAndSaveTransactions(batch, userId, generationTemplate);

    await batch.commit();
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
};

export const updateRecurringSeriesInFirestore = async (userId, oldTemplateId, newTemplateValues) => {
    const batch = writeBatch(db);
    
    // 1. Create NEW template info to get ID
    const newTemplateId = generateDeterministicTemplateId({
        ...newTemplateValues,
        category: newTemplateValues.category || newTemplateValues.Category // Handle case sensitivity if any
    });

    // 2. Delete old template if ID changed
    if (newTemplateId !== oldTemplateId) {
        const oldTemplateRef = doc(db, `users/${userId}/recurringTemplates`, oldTemplateId);
        batch.delete(oldTemplateRef);
    }
    
    // 3. Delete ALL linked transactions of old template
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("Model", "==", oldTemplateId)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 4. Create NEW template document
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
    
    // 5. Generate and save child transactions
    batchGenerateAndSaveTransactions(batch, userId, generationTemplate);

    await batch.commit();
};

export const deleteRecurringSeriesInFirestore = async (userId, templateId) => {
    const batch = writeBatch(db);
    
    // 1. Delete the template
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, templateId);
    batch.delete(templateRef);
    
    // 2. Delete ALL linked transactions
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("Model", "==", templateId)
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
};

export const resetDataInFirestore = async (userId, deleteAccounts, deleteTransactions) => {
    // This function remains the same as it correctly deletes all transaction-related collections.
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
    // This function remains the same
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
};

export const updateSettingsInFirestore = async (userId, settingsId, data) => {
    const docRef = doc(db, `users/${userId}/settings`, settingsId);
    await setDoc(docRef, { ...data, updated_at: serverTimestamp() });
};
