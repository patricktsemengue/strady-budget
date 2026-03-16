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
    const batch = writeBatch(db);
    const templateRef = doc(db, `users/${userId}/recurringTemplates`, template.id);
    
    const today = new Date();
    const horizonDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);
    
    // Parse start and end dates
    const startDate = new Date(template.startMonth + "-01");
    const endDate = template.endMonth ? new Date(template.endMonth + "-01") : new Date(startDate.getFullYear() + 100, 0, 1);
    
    let currentGenDate = new Date(startDate);
    
    // Generate transactions from startDate to min(endDate - 1 day, horizonDate)
    while (currentGenDate < endDate && currentGenDate <= horizonDate) {
        const txId = generateId();
        const txRef = doc(db, `users/${userId}/transactions`, txId);
        
        batch.set(txRef, {
            id: txId,
            label: template.label,
            amount: template.amount,
            date: currentGenDate.toISOString().split('T')[0],
            category: template.category,
            sourceId: template.sourceId,
            destinationId: template.destinationId,
            isRecurringInst: true,
            parentId: template.id,
            updated_at: serverTimestamp()
        });
        
        // Increment month
        currentGenDate.setMonth(currentGenDate.getMonth() + 1);
    }

    batch.set(templateRef, { 
        ...template, 
        nextGenerationDate: currentGenDate.toISOString(),
        updated_at: serverTimestamp() 
    });

    await batch.commit();
};

export const checkAndGenerateRecurring = async (userId) => {
    const templatesSnap = await getDocs(collection(db, `users/${userId}/recurringTemplates`));
    const today = new Date();
    const horizonDate = new Date(today.getFullYear(), today.getMonth() + 12, 1);
    
    const batch = writeBatch(db);
    let hasUpdates = false;

    templatesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const nextGenDate = new Date(data.nextGenerationDate);
        const endDate = data.endMonth ? new Date(data.endMonth + "-01") : new Date(today.getFullYear() + 100, 0, 1);

        if (nextGenDate < endDate && nextGenDate <= horizonDate) {
            hasUpdates = true;
            let currentGenDate = new Date(nextGenDate);
            
            while (currentGenDate < endDate && currentGenDate <= horizonDate) {
                const txId = generateId();
                const txRef = doc(db, `users/${userId}/transactions`, txId);
                
                batch.set(txRef, {
                    id: txId,
                    label: data.label,
                    amount: data.amount,
                    date: currentGenDate.toISOString().split('T')[0],
                    category: data.category,
                    sourceId: data.sourceId,
                    destinationId: data.destinationId,
                    isRecurringInst: true,
                    parentId: data.id,
                    updated_at: serverTimestamp()
                });
                
                currentGenDate.setMonth(currentGenDate.getMonth() + 1);
            }
            
            batch.update(docSnap.ref, { 
                nextGenerationDate: currentGenDate.toISOString(),
                updated_at: serverTimestamp()
            });
        }
    });

    if (hasUpdates) {
        await batch.commit();
    }
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

export const importDataToFirestore = async (userId, accounts, transactions, templates) => {
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
    await Promise.all(promises);
};