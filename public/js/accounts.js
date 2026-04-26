import { state } from './state.js';
import { generateId, getMonthKey, generateDeterministicUUID, getTxDisplayInfo } from './utils.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';
import { 
    addAccountToFirestore, updateAccountInFirestore, deleteAccountFromFirestore,
    addTransactionToFirestore
} from './firestore-service.js';
import { showNotification } from './ui.js';
import { calculateBalances } from './calculations.js';

export const openAddAccountDrawer = () => {
    document.getElementById('add-account-form').reset();
    document.getElementById('drawer-overlay').classList.add('active');
    document.getElementById('account-add-drawer').classList.add('active');
};

export const closeAddAccountDrawer = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('account-add-drawer').classList.remove('active');
};

export const handleAddAccount = async (e) => {
    e.preventDefault();
    const name = document.getElementById('acc-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('acc-balance').value);
    const initialBalanceDate = document.getElementById('acc-balance-date').value;
    const isSaving = document.getElementById('acc-is-savings').checked;
    const isInvestmentAccount = document.getElementById('acc-is-investment').checked;

    if (!name || isNaN(initialBalance) || !initialBalanceDate) {
        showNotification('Veuillez remplir tous les champs.', 'error');
        return;
    }

    if (state.accounts.some(acc => acc.name.toLowerCase() === name.toLowerCase())) {
        showNotification('Un compte avec ce nom existe déjà.', 'error');
        return;
    }

    try {
        const deterministicId = await generateDeterministicUUID(name);
        const newAccount = {
            id: `acc_${deterministicId}`,
            name,
            initialBalance,
            initialBalanceDate,
            isSaving,
            isInvestmentAccount
        };

        await addAccountToFirestore(currentUserId, newAccount);
        closeAddAccountDrawer();
        showNotification('Compte ajouté !');
    } catch (err) {
        console.error(err);
        showNotification("Erreur lors de l'ajout du compte.", 'error');
    }
};

export const openEditAccount = (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;

    const dateInput = document.getElementById('edit-acc-balance-date');
    const helpText = document.getElementById('edit-acc-date-help');

    // Find oldest transaction
    const accTxs = Object.values(state.records).flatMap(r => r.items).filter(t => t.source === id || t.destination === id);
    if (accTxs.length > 0) {
        const oldestDate = accTxs.reduce((min, t) => t.date < min ? t.date : min, '9999-12-31');
        const limitDate = new Date(oldestDate + 'T00:00:00Z');
        limitDate.setUTCDate(limitDate.getUTCDate() - 1);
        const maxStr = limitDate.toISOString().split('T')[0];
        
        dateInput.max = maxStr;
        if (helpText) helpText.textContent = `Une transaction existe le ${oldestDate}. La date de création ne peut pas dépasser le ${maxStr}.`;
    } else {
        dateInput.max = '';
        if (helpText) helpText.textContent = '';
    }

    document.getElementById('edit-acc-id').value = acc.id;
    document.getElementById('edit-acc-name').value = acc.name;
    
    // Fallback: system no longer stores initialBalance in doc, so we find it from calculated state or history
    const balances = calculateBalances(new Date(acc.createDate || acc.initialBalanceDate));
    document.getElementById('edit-acc-balance').value = balances[acc.id] || 0;
    document.getElementById('edit-acc-balance-date').value = acc.createDate || acc.initialBalanceDate;
    document.getElementById('edit-acc-is-savings').checked = acc.isSaving;
    document.getElementById('edit-acc-is-investment').checked = acc.isInvestmentAccount || false;
    
    document.getElementById('drawer-overlay').classList.add('active');
    document.getElementById('account-edit-drawer').classList.add('active');
};

export const closeAccountDrawer = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('account-edit-drawer').classList.remove('active');
};

export const handleUpdateAccount = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-acc-id').value;
    const name = document.getElementById('edit-acc-name').value.trim();
    const newInitialBalance = parseFloat(document.getElementById('edit-acc-balance').value);
    const createDate = document.getElementById('edit-acc-balance-date').value;
    const isSaving = document.getElementById('edit-acc-is-savings').checked;
    const isInvestmentAccount = document.getElementById('edit-acc-is-investment').checked;

    if (!name || isNaN(newInitialBalance) || !createDate) {
        showNotification('Veuillez remplir tous les champs.', 'error');
        return;
    }

    if (state.accounts.some(acc => acc.name.toLowerCase() === name.toLowerCase() && acc.id !== id)) {
        showNotification('Un autre compte avec ce nom existe déjà.', 'error');
        return;
    }

    const oldAcc = state.accounts.find(a => a.id === id);
    if (!oldAcc) return;

    try {
        // We need the old "Initial Balance" specifically to calculate the delta
        // Since it's not in the object, we recalculate it from the genesis date
        const balancesAtStart = calculateBalances(new Date(oldAcc.createDate || oldAcc.initialBalanceDate));
        const oldInitialBalance = balancesAtStart[id] || 0;

        await updateAccountInFirestore(currentUserId, {
            id,
            name,
            initialBalance: newInitialBalance,
            createDate,
            isSaving,
            isInvestmentAccount
        }, oldInitialBalance);
        closeAccountDrawer();
        showNotification('Compte mis à jour !');
    } catch (err) {
        showNotification('Erreur de mise à jour du compte.', 'error');
    }
};

export const deleteAccount = async (id) => {
    if (confirm(t('confirm.delete_acc'))) {
        try {
            await deleteAccountFromFirestore(currentUserId, id);
            showNotification('Compte supprimé.');
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    }
};

export const openAccountActions = (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    
    const modal = document.getElementById('account-actions-modal');
    const content = document.getElementById('account-actions-content');
    const actionsTitle = document.getElementById('account-actions-title');
    const btnEdit = document.getElementById('account-action-edit');
    const btnDelete = document.getElementById('account-action-delete');
    
    actionsTitle.textContent = acc.name;
    btnEdit.onclick = () => {
        closeAccountActions();
        openEditAccount(id);
    };
    btnDelete.onclick = () => {
        closeAccountActions();
        deleteAccount(id);
    };
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.style.transform = 'translateY(0)';
    }, 10);
};

export const closeAccountActions = () => {
    const modal = document.getElementById('account-actions-modal');
    const content = document.getElementById('account-actions-content');
    
    content.style.transform = 'translateY(100%)';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

export const formatCurrency = (amount) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Renders the grouped list of accounts in the Trésorerie view.
 */
export const renderAccountsList = () => {
    const list = document.getElementById('mgmt-accounts-list');
    const summary = document.getElementById('treasury-summary');
    if (!list || !state.accounts) return;

    const balances = calculateBalances(state.viewDate);

    // Grouping Logic
    const groups = {
        'FLUX COURANTS': [],
        'ÉPARGNE DE PRÉCAUTION': [],
        'PORTEFEUILLES D\'INVEST.': []
    };

    let totalLiquid = 0;
    let totalSavings = 0;
    let totalInvest = 0;

    state.accounts.forEach(acc => {
        const bal = balances[acc.id] || 0;
        if (acc.isInvestmentAccount) {
            groups['PORTEFEUILLES D\'INVEST.'].push({ ...acc, balance: bal });
            totalInvest += bal;
        } else if (acc.isSaving) {
            groups['ÉPARGNE DE PRÉCAUTION'].push({ ...acc, balance: bal });
            totalSavings += bal;
        } else {
            groups['FLUX COURANTS'].push({ ...acc, balance: bal });
            totalLiquid += bal;
        }
    });

    // Render Summary
    if (summary) {
        summary.innerHTML = `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Liquidité Opérationnelle</p>
                <p class="text-xl font-black text-slate-800">${formatCurrency(totalLiquid)}</p>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Total Épargne</p>
                <p class="text-xl font-black text-blue-600">${formatCurrency(totalSavings)}</p>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Total Investissements</p>
                <p class="text-xl font-black text-indigo-600">${formatCurrency(totalInvest)}</p>
            </div>
        `;
    }

    // Render Groups
    const renderGroup = (label, accounts) => {
        if (accounts.length === 0) return '';
        
        const itemsHtml = accounts.map(acc => {
            const isDirty = acc.balanceDirty !== false;
            return `
                <div class="bg-white rounded-xl border border-slate-100 p-4 hover:border-indigo-200 transition-all flex items-center justify-between group shadow-sm">
                    <div class="flex items-center gap-4 cursor-pointer" onclick="window.app.openAccountActions('${acc.id}')">
                        <div class="w-10 h-10 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <i class="fa-solid ${acc.isSaving ? 'fa-piggy-bank' : (acc.isInvestmentAccount ? 'fa-money-bill-trend-up' : 'fa-wallet')}"></i>
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 flex items-center gap-2">
                                ${acc.name}
                                ${isDirty ? '<i class="fa-solid fa-sync fa-spin text-blue-400 text-xs"></i>' : ''}
                            </div>
                            <div class="text-[10px] text-slate-400 font-bold uppercase">${acc.isSaving ? 'Épargne' : (acc.isInvestmentAccount ? 'Investissement' : 'Compte Courant')}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                            <div class="text-lg font-black ${acc.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}">${formatCurrency(acc.balance)}</div>
                            <div class="text-[10px] text-slate-400 font-medium">Solde calculé</div>
                        </div>
                        <button onclick="window.app.openAdjustmentModal('${acc.id}')" class="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                            Ajuster
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="space-y-3">
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">${label}</h3>
                <div class="grid grid-cols-1 gap-3">${itemsHtml}</div>
            </div>
        `;
    };

    list.innerHTML = Object.entries(groups).map(([label, accounts]) => renderGroup(label, accounts)).join('');
};

// --- Adjustment Logic ---

export const openAdjustmentModal = (accountId) => {
    const acc = state.accounts.find(a => a.id === accountId);
    if (!acc) return;

    const balances = calculateBalances(state.viewDate);
    const currentBal = balances[accountId] || 0;

    document.getElementById('adjustment-acc-id').value = accountId;
    document.getElementById('adjustment-acc-name').textContent = acc.name;
    document.getElementById('adjustment-current-bal').textContent = formatCurrency(currentBal);
    document.getElementById('adjustment-new-bal').value = currentBal.toFixed(2);
    document.getElementById('adjustment-date').value = new Date().toISOString().split('T')[0];

    // Populate category dropdown
    const catSelect = document.getElementById('adjustment-category');
    catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    
    // Select "Autre" or similar by default if possible
    const otherCat = state.categories.find(c => c.label.toLowerCase().includes('autre'));
    if (otherCat) catSelect.value = otherCat.id;

    document.getElementById('adjustment-modal').classList.remove('hidden');
};

export const closeAdjustmentModal = () => {
    document.getElementById('adjustment-modal').classList.add('hidden');
};

export const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    const accountId = document.getElementById('adjustment-acc-id').value;
    const newBal = parseFloat(document.getElementById('adjustment-new-bal').value);
    const catId = document.getElementById('adjustment-category').value;
    const date = document.getElementById('adjustment-date').value;

    const balances = calculateBalances(state.viewDate);
    const currentBal = balances[accountId] || 0;
    const diff = newBal - currentBal;

    if (diff === 0) {
        closeAdjustmentModal();
        return;
    }

    const isCredit = diff > 0;
    const amount = Math.abs(diff);

    const txData = {
        label: "Ajustement de trésorerie",
        amount: amount,
        date: date,
        Category: catId,
        source: isCredit ? 'external' : accountId,
        destination: isCredit ? accountId : 'external',
        Model: null
    };

    try {
        const id = generateId(); // Manual adjustments get unique IDs
        await addTransactionToFirestore(currentUserId, { ...txData, id });
        closeAdjustmentModal();
        showNotification(`Trésorerie ajustée de ${formatCurrency(diff)}`);
    } catch (err) {
        console.error(err);
        showNotification("Erreur lors de l'ajustement", "error");
    }
};

// --- Internal Transfer Logic ---

export const openTransferModal = () => {
    const sourceSelect = document.getElementById('transfer-source');
    const destSelect = document.getElementById('transfer-destination');
    
    const options = state.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
    sourceSelect.innerHTML = options;
    destSelect.innerHTML = options;

    if (state.accounts.length >= 2) {
        sourceSelect.selectedIndex = 0;
        destSelect.selectedIndex = 1;
    }

    document.getElementById('transfer-amount').value = '';
    document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('transfer-label').value = "Virement interne";

    document.getElementById('transfer-modal').classList.remove('hidden');
};

export const closeTransferModal = () => {
    document.getElementById('transfer-modal').classList.add('hidden');
};

export const handleTransferSubmit = async (e) => {
    e.preventDefault();
    const srcId = document.getElementById('transfer-source').value;
    const dstId = document.getElementById('transfer-destination').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const date = document.getElementById('transfer-date').value;
    const label = document.getElementById('transfer-label').value || "Virement interne";

    if (srcId === dstId) {
        showNotification("Les comptes source et destination doivent être différents.", "error");
        return;
    }

    if (isNaN(amount) || amount <= 0) return;

    const txData = {
        label,
        amount,
        date,
        Category: state.categories.find(c => c.label.toLowerCase().includes('virement') || c.label.toLowerCase().includes('autre'))?.id || '',
        source: srcId,
        destination: dstId,
        Model: null
    };

    try {
        const id = generateId();
        await addTransactionToFirestore(currentUserId, { ...txData, id });
        closeTransferModal();
        showNotification("Virement exécuté avec succès.");
    } catch (err) {
        console.error(err);
        showNotification("Erreur lors du virement", "error");
    }
};
