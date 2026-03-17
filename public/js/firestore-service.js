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
    const startMonth = template.anchorDate.substring(0, 7);
    await generateJitTransactions(userId, startMonth);
};

export const updateRecurringSeriesInFirestore = async (userId, parentId, monthX, newValues) => {
    const batch = writeBatch(db);
    
    // 1. Update the old template: set endMonth to X-1
    const prevMonthDate = new Date(monthX + "-01");
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const endMonth = prevMonthDate.toISOString().substring(0, 7);
    
    const oldTemplateRef = doc(db, `users/${userId}/recurringTemplates`, parentId);
    batch.update(oldTemplateRef, { endMonth, updated_at: serverTimestamp() });
    
    // 2. Delete future physical transactions of the old template (from monthX onwards)
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("parentId", "==", parentId),
        where("date", ">=", monthX + "-01")
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    // 3. Create a new template version starting from monthX
    const newTemplateId = `rec_${generateId()}`;
    const newTemplateRef = doc(db, `users/${userId}/recurringTemplates`, newTemplateId);
    batch.set(newTemplateRef, {
        ...newValues,
        id: newTemplateId,
        startMonth: monthX,
        updated_at: serverTimestamp()
    });
    
    await batch.commit();
    
    // 4. Generate JIT for the current month with the new template
    await generateJitTransactions(userId, monthX);
};

export const deleteRecurringSeriesInFirestore = async (userId, parentId, monthX) => {
    const batch = writeBatch(db);
    
    // 1. Close the template: endMonth = X-1
    const prevMonthDate = new Date(monthX + "-01");
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const endMonth = prevMonthDate.toISOString().substring(0, 7);
    
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, parentId);
    batch.update(templateRef, { endMonth, updated_at: serverTimestamp() });
    
    // 2. Delete future transactions (from monthX onwards)
    const q = query(
        collection(db, `users/${userId}/transactions`), 
        where("parentId", "==", parentId),
        where("date", ">=", monthX + "-01")
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
        
        // Check if template is active for this month
        const startM = template.startMonth || template.anchorDate.substring(0, 7);
        const endM = template.endMonth;
        
        if (monthKey < startM || (endM && monthKey > endM)) continue;
        
        // Calculate expected dates for this month
        const dates = calculateOccurrencesInMonth(template, monthKey);
        
        for (const date of dates) {
            // Check if transaction already exists for this parent and date
            const q = query(
                collection(db, `users/${userId}/transactions`),
                where("parentId", "==", template.id),
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
                    category: template.category,
                    sourceId: template.sourceId,
                    destinationId: template.destinationId,
                    isRecurringInst: true,
                    parentId: template.id,
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
    const anchorDate = new Date(template.anchorDate);
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
    } else if (template.periodicity === 'W') {
        // Weekly: Every 7 days from anchor
        let current = new Date(anchorDate);
        // Move current to or before the start of target month
        const monthStart = new Date(targetYear, targetMonth, 1);
        const monthEnd = new Date(targetYear, targetMonth + 1, 0);
        
        const diffDays = Math.floor((monthStart - current) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
            const weeksToAdd = Math.floor(diffDays / 7);
            current.setDate(current.getDate() + (weeksToAdd * 7));
        }
        
        while (current <= monthEnd) {
            if (current >= monthStart) {
                occurrences.push(current.toISOString().split('T')[0]);
            }
            current.setDate(current.getDate() + 7);
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