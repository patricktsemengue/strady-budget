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

    let initialLoadsPending = 13; // Increased for onboarding + wealth + currency
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
        assets: [],
        assetValues: [],
        liabilities: [],
        liabilityValues: [],
        months: {},
        accountBalances: {},
        recurringTemplates: [],
        onboarding: null,
        displayCurrency: 'EUR',
        exchangeRates: {},
        monthSelectorConfig: {
            startDate: `${new Date().getFullYear()}-01-01`,
            endDate: getFunctionalBoundaryDate(),
            step: 'month'
        }
    };

    const triggerUpdate = () => {
        onDataUpdate({ ...localState });
    };

    const currencyUnsub = onSnapshot(doc(db, `users/${userId}/settings`, 'currency'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            localState.displayCurrency = data.displayCurrency || 'EUR';
            localState.exchangeRates = data.exchangeRates || {};
        }
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const settingsUnsub = onSnapshot(doc(db, `users/${userId}/settings`, 'monthSelector'), (docSnap) => {
        if (docSnap.exists()) {
            localState.monthSelectorConfig = docSnap.data();
        }
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const efUnsub = onSnapshot(doc(db, `users/${userId}/settings`, 'emergencyFund'), (docSnap) => {
        if (docSnap.exists()) {
            localState.emergencyFundMultiplier = docSnap.data().multiplier || 3;
        }
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const onboardingUnsub = onSnapshot(doc(db, `users/${userId}/settings`, 'onboarding'), (docSnap) => {
        if (docSnap.exists()) {
            localState.onboarding = docSnap.data();
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

    const assetUnsub = onSnapshot(collection(db, `users/${userId}/assets`), (snapshot) => {
        localState.assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const assetValueUnsub = onSnapshot(collection(db, `users/${userId}/asset_values`), (snapshot) => {
        localState.assetValues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const liabilityUnsub = onSnapshot(collection(db, `users/${userId}/liabilities`), (snapshot) => {
        localState.liabilities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const liabilityValueUnsub = onSnapshot(collection(db, `users/${userId}/liability_values`), (snapshot) => {
        localState.liabilityValues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const key = `${data.account_id}_${data.date}`;
            localState.accountBalances[key] = data.balance;
        });
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    const recUnsub = onSnapshot(collection(db, `users/${userId}/recurringTemplates`), (snapshot) => {
        localState.recurringTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (initialLoadsPending > 0) onInitialLoadComplete(); else triggerUpdate();
    });

    unsubscribes.push(accUnsub, catUnsub, txUnsub, monthsUnsub, balUnsub, recUnsub, settingsUnsub, onboardingUnsub, assetUnsub, assetValueUnsub, liabilityUnsub, liabilityValueUnsub);
};

// Wealth Operations
export const addAssetToFirestore = async (userId, asset) => {
    const docRef = doc(db, `users/${userId}/assets`, asset.id);
    await setDoc(docRef, { ...asset, updated_at: serverTimestamp() });
};

export const deleteAssetFromFirestore = async (userId, assetId) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, `users/${userId}/assets`, assetId));
    
    const q = query(collection(db, `users/${userId}/asset_values`), where("asset_id", "==", assetId));
    const snapshot = await getDocs(q);
    snapshot.forEach(d => batch.delete(d.ref));
    
    await batch.commit();
};

export const addAssetValueToFirestore = async (userId, val) => {
    const id = generateId();
    const docRef = doc(db, `users/${userId}/asset_values`, id);
    await setDoc(docRef, { ...val, id, updated_at: serverTimestamp() });
};

export const deleteAssetValueFromFirestore = async (userId, valId) => {
    await deleteDoc(doc(db, `users/${userId}/asset_values`, valId));
};

export const addLiabilityToFirestore = async (userId, liability) => {
    const docRef = doc(db, `users/${userId}/liabilities`, liability.id);
    await setDoc(docRef, { ...liability, updated_at: serverTimestamp() });
};

export const deleteLiabilityFromFirestore = async (userId, liabilityId) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, `users/${userId}/liabilities`, liabilityId));
    
    const q = query(collection(db, `users/${userId}/liability_values`), where("liability_id", "==", liabilityId));
    const snapshot = await getDocs(q);
    snapshot.forEach(d => batch.delete(d.ref));
    
    await batch.commit();
};

export const addLiabilityValueToFirestore = async (userId, val) => {
    const id = generateId();
    const docRef = doc(db, `users/${userId}/liability_values`, id);
    await setDoc(docRef, { ...val, id, updated_at: serverTimestamp() });
};

export const deleteLiabilityValueFromFirestore = async (userId, valId) => {
    await deleteDoc(doc(db, `users/${userId}/liability_values`, valId));
};

export const addAccountToFirestore = async (userId, account) => {
    const docRef = doc(db, `users/${userId}/accounts`, account.id);
    const createDate = account.createDate || account.initialBalanceDate;
    
    const accountData = { 
        id: account.id,
        name: account.name,
        createDate: createDate,
        isSaving: !!account.isSaving,
        isInvestmentAccount: !!account.isInvestmentAccount,
        balanceDirty: false,
        updated_at: serverTimestamp() 
    };
    
    await setDoc(docRef, accountData);

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
        
        const accountData = { 
            id: account.id,
            name: account.name,
            createDate: createDate || oldData.createDate,
            isSaving: !!account.isSaving,
            isInvestmentAccount: !!account.isInvestmentAccount,
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

        transaction.set(docRef, { ...accountData, balanceDirty: false });
    });
};

export const deleteAccountFromFirestore = async (userId, accountId) => {
    const docRef = doc(db, `users/${userId}/accounts`, accountId);
    await deleteDoc(docRef);

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
        const data = { 'index-order': update['index-order'], updated_at: serverTimestamp() };
        if (update.nature) data.nature = update.nature;
        batch.update(docRef, data);
    });
    await batch.commit();
};


export const addTransactionToFirestore = async (userId, tx) => {
    const docRef = doc(db, `users/${userId}/transactions`, tx.id);
    await setDoc(docRef, { ...tx, updated_at: serverTimestamp() });
    
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

export const updateMonthStatus = async (userId, monthKey, status) => {
    const docRef = doc(db, `users/${userId}/months`, monthKey);
    await setDoc(docRef, { status, updated_at: serverTimestamp() }, { merge: true });
};


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
    await markAccountsBalanceDirty(userId); 
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
    await markAccountsBalanceDirty(userId); 
};

export const resetDataInFirestore = async (userId, deleteAccounts, deleteTransactions) => {
    const CHUNK_SIZE = 500;
    let allRefs = [];
    
    if (deleteTransactions) {
        const txSnap = await getDocs(collection(db, `users/${userId}/transactions`));
        txSnap.forEach(docSnap => allRefs.push(docSnap.ref));
        const moSnap = await getDocs(collection(db, `users/${userId}/months`));
        moSnap.forEach(docSnap => allRefs.push(docSnap.ref));
        const recSnap = await getDocs(collection(db, `users/${userId}/recurringTemplates`));
        recSnap.forEach(docSnap => allRefs.push(docSnap.ref));
    }
    
    if (deleteAccounts) {
        const accSnap = await getDocs(collection(db, `users/${userId}/accounts`));
        accSnap.forEach(docSnap => allRefs.push(docSnap.ref));
        
        const balSnap = await getDocs(collection(db, `users/${userId}/account_balances`));
        balSnap.forEach(docSnap => allRefs.push(docSnap.ref));

        const astSnap = await getDocs(collection(db, `users/${userId}/assets`));
        astSnap.forEach(docSnap => allRefs.push(docSnap.ref));

        const astvSnap = await getDocs(collection(db, `users/${userId}/asset_values`));
        astvSnap.forEach(docSnap => allRefs.push(docSnap.ref));

        const liaSnap = await getDocs(collection(db, `users/${userId}/liabilities`));
        liaSnap.forEach(docSnap => allRefs.push(docSnap.ref));

        const liavSnap = await getDocs(collection(db, `users/${userId}/liability_values`));
        liavSnap.forEach(docSnap => allRefs.push(docSnap.ref));
    }
    
    // Process deletions in batches of 500
    for (let i = 0; i < allRefs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = allRefs.slice(i, i + CHUNK_SIZE);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }
};

export const importDataToFirestore = async (userId, accounts, transactions, templates, categories, assets, assetValues, liabilities, liabilityValues) => {
    const CHUNK_SIZE = 500;
    const allOperations = [];

    if (accounts) {
        accounts.forEach(acc => {
            const createDate = acc.createDate || acc.initialBalanceDate;
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/accounts`, acc.id),
                data: { 
                    id: acc.id,
                    name: acc.name,
                    createDate: createDate,
                    isSaving: !!acc.isSaving,
                    isInvestmentAccount: !!acc.isInvestmentAccount,
                    balanceDirty: false,
                    updated_at: serverTimestamp() 
                }
            });

            const balDocId = `${acc.id}_${createDate}`;
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/account_balances`, balDocId),
                data: {
                    account_id: acc.id,
                    date: createDate,
                    balance: acc.initialBalance || 0,
                    updated_at: serverTimestamp()
                }
            });
        });
    }

    if (categories) {
        categories.forEach(cat => {
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/categories`, cat.id),
                data: { ...cat, updated_at: serverTimestamp() }
            });
        });
    }

    if (transactions) {
        transactions.forEach(tx => {
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/transactions`, tx.id),
                data: { ...tx, updated_at: serverTimestamp() }
            });
        });
    }

    if (templates) {
        const boundaryDateStr = getFunctionalBoundaryDate();
        templates.forEach(rec => {
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/recurringTemplates`, rec.id),
                data: { ...rec, updated_at: serverTimestamp() }
            });

            // Generate child transactions for the imported template
            const generationTemplate = { ...rec };
            // Ensure we don't generate past the boundary
            if (!generationTemplate.endDate || generationTemplate.endDate > boundaryDateStr) {
                generationTemplate.endDate = boundaryDateStr;
            }

            const dates = calculateAllOccurrences(generationTemplate);
            for (const date of dates) {
                const txData = {
                    label: rec.label,
                    amount: rec.amount,
                    date: date,
                    Category: rec.category,
                    source: rec.source,
                    destination: rec.destination,
                    Model: rec.id,
                };
                const txId = generateDeterministicTransactionId(txData);
                allOperations.push({
                    type: 'set',
                    ref: doc(db, `users/${userId}/transactions`, txId),
                    data: {
                        id: txId,
                        ...txData,
                        updated_at: serverTimestamp()
                    }
                });
            }
        });
    }

    if (assets) {
        assets.forEach(ast => {
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/assets`, ast.id),
                data: { ...ast, updated_at: serverTimestamp() }
            });
        });
    }

    if (assetValues) {
        assetValues.forEach(val => {
            const id = generateId();
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/asset_values`, id),
                data: { ...val, id, updated_at: serverTimestamp() }
            });
        });
    }

    if (liabilities) {
        liabilities.forEach(lia => {
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/liabilities`, lia.id),
                data: { ...lia, updated_at: serverTimestamp() }
            });
        });
    }

    if (liabilityValues) {
        liabilityValues.forEach(val => {
            const id = generateId();
            allOperations.push({
                type: 'set',
                ref: doc(db, `users/${userId}/liability_values`, id),
                data: { ...val, id, updated_at: serverTimestamp() }
            });
        });
    }

    // Process in batches of 500
    for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = allOperations.slice(i, i + CHUNK_SIZE);
        chunk.forEach(op => {
            if (op.type === 'set') batch.set(op.ref, op.data);
            else if (op.type === 'update') batch.update(op.ref, op.data);
            else if (op.type === 'delete') batch.delete(op.ref);
        });
        await batch.commit();
    }

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

const triggerSWRefresh = async (userId, action, data) => {
    console.log(`[FirestoreService] Triggering balance ${action} for accounts:`, data.accountId || data.accountIds);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'REFRESH_BALANCES',
            payload: { userId, action, data }
        });
    } else {
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

        triggerSWRefresh(userId, 'SWEEP', { accountIds: targets });
        
    } catch (error) {
        console.error("Error triggering balance refresh:", error);
    }
};

export const markSingleAccountBalanceDelta = async (userId, accountId, amount, date) => {
    if (!userId || !accountId || accountId === 'external' || amount === 0) return;
    
    const accRef = doc(db, `users/${userId}/accounts`, accountId);
    await setDoc(accRef, { balanceDirty: true, updated_at: serverTimestamp() }, { merge: true });

    triggerSWRefresh(userId, 'DELTA', { accountId, amount, date });
};

export const provisionStarterData = async (userId) => {
    try {
        const response = await fetch('/data/starter-data.json');
        if (!response.ok) throw new Error('Failed to load starter data');
        const data = await response.json();

        const batch = writeBatch(db);
        const now = new Date();
        const currentMonthStr = now.toISOString().split('T')[0].substring(0, 7);
        const todayStr = now.toISOString().split('T')[0];
        const boundaryDateStr = getFunctionalBoundaryDate();

        // 1. Categories
        data.categories.forEach(cat => {
            const ref = doc(db, `users/${userId}/categories`, cat.id);
            batch.set(ref, { ...cat, updated_at: serverTimestamp() });
        });

        // 2. Accounts
        data.accounts.forEach(acc => {
            const createDate = `${currentMonthStr}-${String(acc.day || 1).padStart(2, '0')}`;
            const ref = doc(db, `users/${userId}/accounts`, acc.id);
            batch.set(ref, {
                id: acc.id,
                name: acc.name,
                createDate: createDate,
                isSaving: acc.isSaving || false,
                isInvestmentAccount: acc.isInvestmentAccount || false,
                balanceDirty: false,
                updated_at: serverTimestamp()
            });

            const balDocId = `${acc.id}_${createDate}`;
            const balRef = doc(db, `users/${userId}/account_balances`, balDocId);
            batch.set(balRef, {
                account_id: acc.id,
                date: createDate,
                balance: acc.initialBalance,
                updated_at: serverTimestamp()
            });
        });

        // 3. Recurring Templates
        data.templates.forEach(tpl => {
            const date = `${currentMonthStr}-${String(tpl.day || 1).padStart(2, '0')}`;
            const tplData = { ...tpl, date, endDate: null };
            delete tplData.day;

            const ref = doc(db, `users/${userId}/recurringTemplates`, tpl.id);
            batch.set(ref, { ...tplData, updated_at: serverTimestamp() });

            const generationTemplate = { ...tplData };
            generationTemplate.endDate = boundaryDateStr;

            const dates = calculateAllOccurrences(generationTemplate);
            for (const d of dates) {
                const txData = {
                    label: tpl.label,
                    amount: tpl.amount,
                    date: d,
                    Category: tpl.category,
                    source: tpl.source,
                    destination: tpl.destination,
                    Model: tpl.id,
                };
                const txId = generateDeterministicTransactionId(txData);
                const txRef = doc(db, `users/${userId}/transactions`, txId);
                batch.set(txRef, {
                    id: txId,
                    ...txData,
                    updated_at: serverTimestamp()
                });
            }
        });

        // 4. Past Transactions
        data.pastTransactions.forEach(tx => {
            const d = new Date(now);
            d.setDate(now.getDate() - (tx.daysAgo || 0));
            const dateStr = d.toISOString().split('T')[0];

            const txData = {
                label: tx.label,
                amount: tx.amount,
                date: dateStr,
                Category: tx.category,
                source: tx.source,
                destination: tx.destination
            };
            const txId = generateDeterministicTransactionId(txData);
            const txRef = doc(db, `users/${userId}/transactions`, txId);
            batch.set(txRef, {
                id: txId,
                ...txData,
                updated_at: serverTimestamp()
            });
        });

        // 5. Assets
        (data.assets || []).forEach(ast => {
            const assetRef = doc(db, `users/${userId}/assets`, ast.id);
            batch.set(assetRef, { id: ast.id, name: ast.name, updated_at: serverTimestamp() });

            const valId = generateId();
            const valRef = doc(db, `users/${userId}/asset_values`, valId);
            batch.set(valRef, {
                id: valId,
                asset_id: ast.id,
                date: todayStr,
                value: ast.value,
                quantity: ast.quantity || 1,
                updated_at: serverTimestamp()
            });
        });

        // 6. Liabilities
        (data.liabilities || []).forEach(lia => {
            const liaRef = doc(db, `users/${userId}/liabilities`, lia.id);
            batch.set(liaRef, { id: lia.id, name: lia.name, updated_at: serverTimestamp() });

            const valId = generateId();
            const valRef = doc(db, `users/${userId}/liability_values`, valId);
            batch.set(valRef, {
                id: valId,
                liability_id: lia.id,
                date: todayStr,
                value: lia.value,
                quantity: 1,
                updated_at: serverTimestamp()
            });
        });

        // 7. Onboarding Setting
        const onboardingRef = doc(db, `users/${userId}/settings`, 'onboarding');
        batch.set(onboardingRef, {
            starterPackApplied: true,
            onboardingComplete: true,
            updated_at: serverTimestamp()
        });

        await batch.commit();
        await markAccountsBalanceDirty(userId);
    } catch (error) {
        console.error('Provisioning failed:', error);
        throw error;
    }
};
