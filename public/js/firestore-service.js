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

    let initialLoadsPending = 5;
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
        recurringTemplates: []
    };

    const triggerUpdate = () => {
        onDataUpdate({ ...localState });
        saveDataToCache(userId, localState);
    };

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
    let current = new Date(template.date + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
    const endDate = new Date(template.endDate + 'T23:59:59');
    const anchorDay = current.getDate();

    while (current <= endDate) {
        occurrences.push(current.toISOString().split('T')[0]);

        switch (template.periodicity) {
            case 'M':
                current = new Date(current.getFullYear(), current.getMonth() + 1, anchorDay);
                if (current.getDate() !== anchorDay) {
                    current = new Date(current.getFullYear(), current.getMonth(), 0);
                }
                break;
            case 'Q':
                current = new Date(current.getFullYear(), current.getMonth() + 3, anchorDay);
                if (current.getDate() !== anchorDay) {
                    current = new Date(current.getFullYear(), current.getMonth(), 0);
                }
                break;
            case 'Y':
                current = new Date(current.getFullYear() + 1, current.getMonth(), anchorDay);
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

    const startDate = new Date(template.date + 'T00:00:00');
    // Boundary of 36 months
    const boundaryDate = new Date(startDate.getFullYear() + 3, startDate.getMonth(), startDate.getDate() - 1);
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

export const updateRecurringSeriesInFirestore = async (userId, oldTemplateId, newTemplateValues) => {
    // Generate the ID for the new state to check if it's actually a change in core fields
    const newTemplateId = generateDeterministicTemplateId(newTemplateValues);
    
    // Rule: if reccTemplateT1 = reccTemplateT0, the system continues with reccTemplateT0.
    if (newTemplateId === oldTemplateId) {
        // Just update the existing template (non-core fields or just refresh timestamp)
        const templateRef = doc(db, `users/${userId}/recurringTemplates`, oldTemplateId);
        await setDoc(templateRef, { ...newTemplateValues, id: oldTemplateId, updated_at: serverTimestamp() }, { merge: true });
        return;
    }

    const batch = writeBatch(db);
    
    const newStartDate = new Date(newTemplateValues.date);
    const oldTemplateRef = doc(db, `users/${userId}/recurringTemplates`, oldTemplateId);
    const oldTemplateSnap = await getDoc(oldTemplateRef); 
    const oldTemplateData = oldTemplateSnap.data();

    if (!oldTemplateData) {
        throw new Error("Template non trouvé");
    }

    // CASE 1: New start date is LATER than the old one.
    if (newStartDate > new Date(oldTemplateData.date)) {
        // Update the old template: set its endDate to the day before the new series starts.
        const prevDay = new Date(newStartDate);
        prevDay.setDate(prevDay.getDate() - 1);
        const oldTemplateEndDateStr = prevDay.toISOString().substring(0, 10);
        
        batch.update(oldTemplateRef, { endDate: oldTemplateEndDateStr, updated_at: serverTimestamp() });
        
        // Clean up future transactions from the old template.
        const q = query(
            collection(db, `users/${userId}/transactions`), 
            where("Model", "==", oldTemplateId),
            where("date", ">=", newTemplateValues.date)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

    // CASE 2: New start date is EARLIER than or SAME as the old one.
    } else {
        // Delete the old template and all its children.
        batch.delete(oldTemplateRef);
        const q = query(
            collection(db, `users/${userId}/transactions`), 
            where("Model", "==", oldTemplateId)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
    }

    // --- CREATE THE NEW TEMPLATE ---
    const newTemplate = { 
        ...newTemplateValues,
        id: newTemplateId,
    };
    
    const startDate = new Date(newTemplate.date + 'T00:00:00');
    const boundaryDate = new Date(startDate.getFullYear() + 3, startDate.getMonth(), startDate.getDate() - 1);
    const boundaryDateStr = boundaryDate.toISOString().split('T')[0];

    const generationTemplate = { ...newTemplate };

    if (!newTemplate.endDate) {
        // Case: User did NOT edit endDate -> Store as NULL, generate up to boundary
        generationTemplate.endDate = boundaryDateStr;
        newTemplate.endDate = null;
    } else {
        // Case: User HAS edited endDate -> Store as edited, generate up to MIN(edited, boundary)
        generationTemplate.endDate = newTemplate.endDate > boundaryDateStr ? boundaryDateStr : newTemplate.endDate;
    }

    const newTemplateRef = doc(db, `users/${userId}/recurringTemplates`, newTemplateId);
    batch.set(newTemplateRef, {
        ...newTemplate, 
        updated_at: serverTimestamp()
    });
    
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
