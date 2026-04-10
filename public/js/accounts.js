import { state } from './state.js';
import { generateId } from './utils.js';
import { currentUserId } from './storage.js';
import { addAccountToFirestore, updateAccountInFirestore, deleteAccountFromFirestore } from './firestore-service.js';
import { showNotification } from './ui.js';
import { router } from './app-router.js';

// NOTE: The following are basic implementations for CRUD operations.

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
    const isSavings = document.getElementById('acc-is-savings').checked;

    if (!name || isNaN(initialBalance) || !initialBalanceDate) {
        showNotification('Veuillez remplir tous les champs.', 'error');
        return;
    }

    const newAccount = {
        id: `acc_${generateId()}`,
        name,
        initialBalance,
        initialBalanceDate,
        isSavings
    };

    try {
        await addAccountToFirestore(currentUserId, newAccount);
        closeAddAccountDrawer();
        showNotification('Compte ajouté !');
    } catch (err) {
        showNotification("Erreur lors de l'ajout du compte.", 'error');
    }
};

export const openEditAccount = (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;

    // Check if in use
    const isUsedInTransactions = state.transactions.some(tx => tx.source === id || tx.destination === id);
    const isUsedInTemplates = state.recurringTemplates.some(tpl => tpl.source === id || tpl.destination === id);

    if (isUsedInTransactions || isUsedInTemplates) {
        showNotification("Impossible de modifier un compte actuellement utilisé.", "error");
        return;
    }

    document.getElementById('edit-acc-id').value = acc.id;
    document.getElementById('edit-acc-name').value = acc.name;
    document.getElementById('edit-acc-balance').value = acc.initialBalance;
    document.getElementById('edit-acc-balance-date').value = acc.initialBalanceDate;
    document.getElementById('edit-acc-is-savings').checked = acc.isSavings;
    
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
    const initialBalance = parseFloat(document.getElementById('edit-acc-balance').value);
    const initialBalanceDate = document.getElementById('edit-acc-balance-date').value;
    const isSavings = document.getElementById('edit-acc-is-savings').checked;

    if (!name || isNaN(initialBalance) || !initialBalanceDate) {
        showNotification('Veuillez remplir tous les champs.', 'error');
        return;
    }

    // Double check if in use
    const isUsedInTransactions = state.transactions.some(tx => tx.source === id || tx.destination === id);
    const isUsedInTemplates = state.recurringTemplates.some(tpl => tpl.source === id || tpl.destination === id);

    if (isUsedInTransactions || isUsedInTemplates) {
        showNotification("Impossible de modifier un compte actuellement utilisé.", "error");
        closeAccountDrawer();
        return;
    }

    try {
        await updateAccountInFirestore(currentUserId, {
            id,
            name,
            initialBalance,
            initialBalanceDate,
            isSavings
        });
        closeAccountDrawer();
        showNotification('Compte mis à jour !');
    } catch (err) {
        showNotification('Erreur de mise à jour du compte.', 'error');
    }
};

import { formatCurrency, getMonthKey } from './utils.js';
import { calculateBalances } from './calculations.js';

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
        filteredAccounts = filteredAccounts.filter(acc => !acc.isSavings);
    } else if (typeFilter === 'savings') {
        filteredAccounts = filteredAccounts.filter(acc => acc.isSavings);
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
            case 'type':
                return (a.isSavings === b.isSavings) ? a.name.localeCompare(b.name) : (a.isSavings ? 1 : -1);
            case 'balance-desc':
                return balB - balA || a.name.localeCompare(b.name);
            case 'balance-asc':
                return balA - balB || a.name.localeCompare(b.name);
            default: // name-asc
                return a.name.localeCompare(b.name);
        }
    });

    const usedAccountIds = new Set();
    // Use all transactions and templates for the 'in use' check
    const allRecords = Object.values(state.records).flatMap(r => r.items);
    allRecords.forEach(tx => {
        if (tx.source) usedAccountIds.add(tx.source);
        if (tx.destination) usedAccountIds.add(tx.destination);
    });
    state.recurringTemplates.forEach(tpl => {
        if (tpl.source) usedAccountIds.add(tpl.source);
        if (tpl.destination) usedAccountIds.add(tpl.destination);
    });

    const renderActions = (acc, isDisabled, disabledTitle, isMobile = false) => {
        if (isMobile) {
            return `<button onclick="window.app.openAccountActions('${acc.id}')" class="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>`;
        }
        return `
            <div class="flex items-center justify-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="window.app.openEditAccount('${acc.id}')" class="p-2 text-slate-400 hover:text-blue-600 transition-colors disabled:text-slate-200" ${isDisabled ? `disabled title="${disabledTitle}"` : 'title="Modifier le compte"'}><i class="fa-solid fa-pen text-xs"></i></button>
                <button onclick="window.app.deleteAccount('${acc.id}')" class="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:text-slate-200" ${isDisabled ? `disabled title="${disabledTitle}"` : 'title="Supprimer le compte"'}><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>`;
    };

    // Render mobile cards
    if (list) {
        list.innerHTML = filteredAccounts.map(acc => {
            const isUsed = usedAccountIds.has(acc.id);
            const disabledTitle = "Compte utilisé";
            const balance = balances[acc.id] || 0;

            return `
                <li data-id="${acc.id}" class="p-4 flex items-center justify-between gap-4 group">
                    <div class="flex items-center gap-4 flex-grow truncate">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-blue-500 flex-shrink-0"><i class="fa-solid fa-landmark"></i></div>
                        <div class="flex-1 truncate">
                            <div class="flex items-center gap-2">
                                <p class="font-semibold text-slate-800 truncate">${acc.name}</p>
                                ${acc.balanceDirty !== false ? '<i class="fa-solid fa-arrows-rotate fa-spin text-[10px] text-amber-500" title="Recalcul des soldes en cours ..."></i>' : ''}
                            </div>
                            <div class="flex items-center gap-2">
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${acc.isSavings ? 'Épargne' : 'Courant'}</p>
                                <p class="text-xs font-bold text-slate-700 flex items-center gap-1">
                                    ${formatCurrency(balance)}
                                    ${acc.balanceDirty !== false ? '<i class="fa-solid fa-clock-rotate-left text-[10px] text-amber-500" title="Le solde affiché peut être obsolète. Mise à jour en cours."></i>' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${renderActions(acc, isUsed, disabledTitle, true)}
                    </div>
                </li>`;
        }).join('');
    }

    // Render desktop table
    if (tableBody) {
        tableBody.innerHTML = filteredAccounts.map(acc => {
            const isUsed = usedAccountIds.has(acc.id);
            const disabledTitle = "Ce compte est utilisé et ne peut pas être supprimé.";
            const balance = balances[acc.id] || 0;

            return `
                <tr data-id="${acc.id}" class="group hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 text-sm font-medium text-slate-700">
                        <div class="flex items-center gap-2">
                            ${acc.name}
                            ${acc.balanceDirty !== false ? '<i class="fa-solid fa-arrows-rotate fa-spin text-[10px] text-amber-500" title="Recalcul des soldes en cours ..."></i>' : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${acc.isSavings ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                            ${acc.isSavings ? 'Épargne' : 'Courant'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-1">
                            <span class="text-sm font-bold text-slate-700">${formatCurrency(balance)}</span>
                            ${acc.balanceDirty !== false ? '<i class="fa-solid fa-clock-rotate-left text-[10px] text-amber-500" title="Le solde affiché peut être obsolète. Mise à jour en cours."></i>' : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        ${renderActions(acc, isUsed, disabledTitle, false)}
                    </td>
                </tr>`;
        }).join('');
    }
};

let currentAccountActionId = null;

export const openAccountActions = (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;

    currentAccountActionId = id;
    const modal = document.getElementById('account-actions-modal');
    const content = document.getElementById('account-actions-content');
    const title = document.getElementById('account-actions-title');

    title.textContent = acc.name;
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        content.style.transform = 'translateY(0)';
    }, 10);

    // Check if in use for mobile actions
    const isUsedInTransactions = state.transactions.some(tx => tx.source === id || tx.destination === id);
    const isUsedInTemplates = state.recurringTemplates.some(tpl => tpl.source === id || tpl.destination === id);

    const setupAction = (btnId, actionFn, isDisabled) => {
        const btn = document.getElementById(btnId);
        btn.disabled = isDisabled;
        btn.classList.toggle('opacity-50', isDisabled);
        btn.onclick = isDisabled ? null : () => {
            closeAccountActions();
            actionFn(currentAccountActionId);
        };
    };

    setupAction('account-action-edit', openEditAccount, isUsedInTransactions || isUsedInTemplates);
    setupAction('account-action-delete', deleteAccount, isUsedInTransactions || isUsedInTemplates);

    modal.onclick = (e) => {
        if (e.target === modal) closeAccountActions();
    };
};

export const closeAccountActions = () => {
    const modal = document.getElementById('account-actions-modal');
    const content = document.getElementById('account-actions-content');
    
    content.style.transform = 'translateY(100%)';
    setTimeout(() => {
        modal.classList.add('hidden');
        currentAccountActionId = null;
    }, 300);
};

/**
 * Handles the account deletion process.
 */
export const deleteAccount = async (id) => {
    // Final check to ensure account is not in use, in case UI is out of sync.
    const isUsedInTransactions = state.transactions.some(tx => tx.source === id || tx.destination === id);
    const isUsedInTemplates = state.recurringTemplates.some(tpl => tpl.source === id || tpl.destination === id);

    if (isUsedInTransactions || isUsedInTemplates) {
        showNotification("Impossible de supprimer un compte actuellement utilisé.", "error");
        router.render(); // Re-render to fix the UI state if it was incorrect
        return;
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer ce compte ? Cette action est irréversible.')) {
        try {
            await deleteAccountFromFirestore(currentUserId, id);
            showNotification('Compte supprimé.');
        } catch (err) {
            console.error("Error deleting account:", err);
            showNotification('Erreur de suppression du compte.', 'error');
        }
    }
};
