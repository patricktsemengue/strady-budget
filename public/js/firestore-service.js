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
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from "./auth.js";
import { generateId, getMonthKey } from "./utils.js";

const db = getFirestore();
let unsubscribes = [];

export const unsubscribeFromData = () => {
    unsubscribes.forEach(unsub => unsub());
    unsubscribes = [];
};

export const subscribeToAppData = (userId, onDataUpdate) => {
    unsubscribeFromData();
    if (!userId) return;

    let localState = {
        accounts: [],
        categories: [],
        transactions: [],
        months: {},
        recurringTemplates: []
    };

    const triggerUpdate = () => onDataUpdate({ ...localState });

    // Listen to Accounts
    const accUnsub = onSnapshot(collection(db, `users/${userId}/accounts`), (snapshot) => {
        localState.accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        triggerUpdate();
    });

    // Listen to Categories
    const catUnsub = onSnapshot(collection(db, `users/${userId}/categories`), (snapshot) => {
        localState.categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        triggerUpdate();
    });

    // Listen to Transactions
    const txUnsub = onSnapshot(collection(db, `users/${userId}/transactions`), (snapshot) => {
        localState.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        triggerUpdate();
    });

    // Listen to Months
    const monthsUnsub = onSnapshot(collection(db, `users/${userId}/months`), (snapshot) => {
        localState.months = {};
        snapshot.docs.forEach(doc => {
            localState.months[doc.id] = doc.data();
        });
        triggerUpdate();
    });

    // Listen to Recurring Templates
    const recUnsub = onSnapshot(collection(db, `users/${userId}/recurringTemplates`), (snapshot) => {
        localState.recurringTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        triggerUpdate();
    });

    unsubscribes.push(accUnsub, catUnsub, txUnsub, monthsUnsub, recUnsub);
};

// -- ACCOUNTS --
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

// -- CATEGORIES --
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

// -- TRANSACTIONS --
export const addTransactionToFirestore = async (userId, tx) => {
    const docRef = doc(db, `users/${userId}/transactions`, tx.id);
    await setDoc(docRef, { ...tx, updated_at: serverTimestamp() });
};

export const updateTransactionInFirestore = async (userId, tx) => {
    const docRef = doc(db, `users/${userId}/transactions`, tx.id);
    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error("Document does not exist!");
        transaction.update(docRef, { ...tx, updated_at: serverTimestamp() });
    });
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

// -- RECURRING TRANSACTIONS BATCHING --
export const addRecurringTemplate = async (userId, template) => {
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, template.id);
    await setDoc(templateRef, { 
        ...template, 
        updated_at: serverTimestamp() 
    });
    // Trigger initial generation for the month of the start date
    if (template.date) {
        const startMonth = template.date.substring(0, 7);
        await generateJitTransactions(userId, startMonth);
    }
};

/**
 * Align with TODO.litcoffee:
 * - Update enddate of old Template
 * - Clean all single transactions linked to old Template having a date out of range
 * - Create new template
 * - Create single transaction for onfocused month
 */
export const updateRecurringSeriesInFirestore = async (userId, oldTemplateId, onFocusedMonthKey, newTemplateValues) => {
    const batch = writeBatch(db);
    
    // 1. Update the old template: set endDate to the day before the focused month's start or some appropriate boundary
    // Based on spec: "updates the enddate of the old Template"
    // Usually this means it ends just before the new one starts.
    const focusedDate = new Date(onFocusedMonthKey + "-01");
    const prevDay = new Date(focusedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const endDateStr = prevDay.toISOString().substring(0, 10);
    
    const oldTemplateRef = doc(db, `users/${userId}/recurringTemplates`, oldTemplateId);
    batch.update(oldTemplateRef, { endDate: endDateStr, updated_at: serverTimestamp() });
    
    // 2. Clean transactions out of range for the old template
    // Range is [template.date, template.endDate]
    // We specifically need to delete those from onFocusedMonth onwards
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("Model", "==", oldTemplateId),
        where("date", ">=", onFocusedMonthKey + "-01")
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    // 3. Create a new template version
    const newTemplateId = `rec_${generateId()}`;
    const newTemplateRef = doc(db, `users/${userId}/recurringTemplates`, newTemplateId);
    batch.set(newTemplateRef, {
        ...newTemplateValues,
        id: newTemplateId,
        updated_at: serverTimestamp()
    });
    
    await batch.commit();
    
    // 4. Generate JIT for the current month with the new template
    await generateJitTransactions(userId, onFocusedMonthKey);
};

/**
 * Align with TODO.litcoffee:
 * "deletes the template and linked transactions"
 */
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

export const generateJitTransactions = async (userId, monthKey) => {
    if (!userId) return;
    
    const templatesSnap = await getDocs(collection(db, `users/${userId}/recurringTemplates`));
    const batch = writeBatch(db);
    let hasNewTxs = false;

    for (const docSnap of templatesSnap.docs) {
        const template = docSnap.data();
        
        // Safety check: skip malformed templates
        if (!template.date) {
            console.warn(`Template ${docSnap.id} is missing a start date. Skipping.`, template);
            continue;
        }

        // Check if template is active for this month
        const endM = template.endDate ? template.endDate.substring(0, 7) : null;
        const startM = template.date.substring(0, 7);
        
        if (monthKey < startM || (endM && monthKey > endM)) continue;
        
        // Calculate expected dates for this month
        const dates = calculateOccurrencesInMonth(template, monthKey);
        
        for (const date of dates) {
            // Check within exact date range if endDate is set
            if (template.endDate && date > template.endDate) continue;
            if (date < template.date) continue;

            // Check if transaction already exists for this parent and date
            // According to Spec: Logical ID check can also be used, but Model + date is safer for JIT
            const q = query(
                collection(db, `users/${userId}/transactions`),
                where("Model", "==", template.id),
                where("date", "==", date)
            );
            const existingSnap = await getDocs(q);
            
            if (existingSnap.empty) {
                const txId = generateId();
                const txRef = doc(db, `users/${userId}/transactions`, txId);
                batch.set(txRef, {
                    id: txId,
                    label: template.label,
                    amount: template.amount,
                    date: date,
                    Category: template.category, // Spec uses category in template, Category in single tx
                    source: template.source,
                    destination: template.destination,
                    Model: template.id,
                    updated_at: serverTimestamp()
                });
                hasNewTxs = true;
            }
        }
    }

    if (hasNewTxs) {
        await batch.commit();
    }
};

const calculateOccurrencesInMonth = (template, monthKey) => {
    const occurrences = [];
    const anchorDate = new Date(template.date);
    const targetMonth = parseInt(monthKey.split('-')[1]) - 1;
    const targetYear = parseInt(monthKey.split('-')[0]);
    
    if (template.periodicity === 'M') {
        // Monthly: Same day as anchor
        const d = new Date(targetYear, targetMonth, anchorDate.getDate());
        // Handle months with fewer days (e.g., 31st to 30th)
        if (d.getMonth() === targetMonth) {
            occurrences.push(d.toISOString().split('T')[0]);
        } else {
            // Last day of month
            const lastDay = new Date(targetYear, targetMonth + 1, 0);
            occurrences.push(lastDay.toISOString().split('T')[0]);
        }
    } else if (template.periodicity === 'Y') {
        // Yearly: Same month and day as anchor
        if (anchorDate.getMonth() === targetMonth) {
            const d = new Date(targetYear, targetMonth, anchorDate.getDate());
            if (d.getMonth() === targetMonth) {
                occurrences.push(d.toISOString().split('T')[0]);
            } else {
                const lastDay = new Date(targetYear, targetMonth + 1, 0);
                occurrences.push(lastDay.toISOString().split('T')[0]);
            }
        }
    } else if (template.periodicity === 'Q') {
        // Quarterly: Every 3 months from anchor
        const anchorMonth = anchorDate.getMonth();
        const diffMonths = (targetYear - anchorDate.getFullYear()) * 12 + (targetMonth - anchorMonth);
        
        if (diffMonths >= 0 && diffMonths % 3 === 0) {
            const d = new Date(targetYear, targetMonth, anchorDate.getDate());
            if (d.getMonth() === targetMonth) {
                occurrences.push(d.toISOString().split('T')[0]);
            } else {
                const lastDay = new Date(targetYear, targetMonth + 1, 0);
                occurrences.push(lastDay.toISOString().split('T')[0]);
            }
        }
    }
    
    return occurrences;
};

export const resetDataInFirestore = async (userId, deleteAccounts, deleteTransactions) => {
    const batch = writeBatch(db);
    let commitNeeded = false;
    let opsCount = 0;
    
    if (deleteTransactions) {
        const txSnap = await getDocs(collection(db, `users/${userId}/transactions`));
        txSnap.forEach(docSnap => {
            batch.delete(docSnap.ref);
            opsCount++;
        });
        const moSnap = await getDocs(collection(db, `users/${userId}/months`));
        moSnap.forEach(docSnap => {
            batch.delete(docSnap.ref);
            opsCount++;
        });
        const recSnap = await getDocs(collection(db, `users/${userId}/recurringTemplates`));
        recSnap.forEach(docSnap => {
            batch.delete(docSnap.ref);
            opsCount++;
        });
        commitNeeded = true;
    }
    
    if (deleteAccounts) {
        const accSnap = await getDocs(collection(db, `users/${userId}/accounts`));
        accSnap.forEach(docSnap => {
            batch.delete(docSnap.ref);
            opsCount++;
        });
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
};