import { state } from './state.js';
import { generateId, getMonthKey, generateDeterministicUUID } from './utils.js';
import { currentUserId } from './storage.js';
import { addAccountToFirestore, updateAccountInFirestore, deleteAccountFromFirestore } from './firestore-service.js';
import { showNotification } from './ui.js';
import { router } from './app-router.js';
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
            isSaving
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
            isSaving
        }, oldInitialBalance);
        closeAccountDrawer();
        showNotification('Compte mis à jour !');
    } catch (err) {
        showNotification('Erreur de mise à jour du compte.', 'error');
    }
};

export const deleteAccount = async (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce compte et TOUTES ses transactions associées ?')) {
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
    
    const actionsDrawer = document.getElementById('account-actions-drawer');
    const actionsTitle = document.getElementById('account-actions-title');
    const btnEdit = document.getElementById('btn-edit-account');
    const btnDelete = document.getElementById('btn-delete-account');
    
    actionsTitle.textContent = acc.name;
    btnEdit.onclick = () => openEditAccount(id);
    btnDelete.onclick = () => deleteAccount(id);
    
    document.getElementById('drawer-overlay').classList.add('active');
    actionsDrawer.classList.add('active');
};

export const closeAccountActions = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('account-actions-drawer').classList.remove('active');
};

export const formatCurrency = (amount) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Renders the list of accounts in the accounts view.
 */
export const renderAccountsList = () => {
    const list = document.getElementById('mgmt-accounts-list');
    const tableBody = document.getElementById('mgmt-accounts-table-body');
    if ((!list && !tableBody) || !state.transactions || !state.recurringTemplates) return;

    // Filters & Search
    const searchFilter = (document.getElementById('search-accounts')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('filter-account-type')?.value || 'all';
    const sortOrder = document.getElementById('sort-accounts')?.value || 'name-asc';

    // Use pre-calculated balances if available for the selected month, otherwise fallback to on-the-fly calculation
    const monthKey = getMonthKey(state.viewDate);
    const balances = state.months[monthKey]?.balances || calculateBalances(state.viewDate);

    let filteredAccounts = [...state.accounts];

    // Apply Filters
    if (typeFilter === 'current') {
        filteredAccounts = filteredAccounts.filter(acc => !acc.isSaving);
    } else if (typeFilter === 'savings') {
        filteredAccounts = filteredAccounts.filter(acc => acc.isSaving);
    }

    // Apply Search (Name, Balance)
    if (searchFilter) {
        filteredAccounts = filteredAccounts.filter(acc => {
            const balance = balances[acc.id] || 0;
            return acc.name.toLowerCase().includes(searchFilter) || 
                   balance.toString().includes(searchFilter);
        });
    }

    // Sort Logic
    filteredAccounts.sort((a, b) => {
        const balA = balances[a.id] || 0;
        const balB = balances[b.id] || 0;
        switch (sortOrder) {
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            case 'balance-desc': return balB - balA;
            case 'balance-asc': return balA - balB;
            default: return 0;
        }
    });

    const renderItem = (acc) => {
        const balance = balances[acc.id] || 0;
        const balColor = balance >= 0 ? 'text-slate-900' : 'text-red-600';
        const typeIcon = acc.isSaving ? 'fa-piggy-bank text-blue-500' : 'fa-wallet text-slate-400';
        const isDirty = acc.balanceDirty !== false;

        return `
            <div class="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group" onclick="window.app.openAccountActions('${acc.id}')">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <i class="fa-solid ${typeIcon}"></i>
                    </div>
                    <div>
                        <div class="font-bold text-slate-800 flex items-center gap-2">
                            ${acc.name}
                            ${isDirty ? '<i class="fa-solid fa-sync fa-spin text-blue-400 text-xs" title="Calcul en cours..."></i>' : ''}
                        </div>
                        <div class="text-xs text-slate-500">${acc.isSaving ? 'Épargne' : 'Compte courant'}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold ${balColor}">${formatCurrency(balance)}</div>
                    <div class="text-xs text-slate-400">Solde estimé</div>
                </div>
            </div>
        `;
    };

    const renderRow = (acc) => {
        const balance = balances[acc.id] || 0;
        const balColor = balance >= 0 ? 'text-slate-900' : 'text-red-600';
        const typeBadge = acc.isSaving ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700';
        const isDirty = acc.balanceDirty !== false;

        return `
            <tr class="hover:bg-slate-50 transition-colors cursor-pointer group" onclick="window.app.openAccountActions('${acc.id}')">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <i class="fa-solid ${acc.isSaving ? 'fa-piggy-bank' : 'fa-wallet'}"></i>
                        </div>
                        <span class="font-semibold text-slate-800 flex items-center gap-2">
                            ${acc.name}
                            ${isDirty ? '<i class="fa-solid fa-sync fa-spin text-blue-400 text-xs"></i>' : ''}
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${typeBadge}">
                        ${acc.isSaving ? 'Épargne' : 'Courant'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="font-bold ${balColor}">${formatCurrency(balance)}</div>
                </td>
                <td class="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="text-slate-400 hover:text-blue-600">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </td>
            </tr>
        `;
    };

    if (list) list.innerHTML = filteredAccounts.map(renderItem).join('');
    if (tableBody) tableBody.innerHTML = filteredAccounts.map(renderRow).join('');
};
