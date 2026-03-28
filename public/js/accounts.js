import { state } from './state.js';
import { generateId } from './utils.js';
import { currentUserId } from './storage.js';
import { addAccountToFirestore, updateAccountInFirestore, deleteAccountFromFirestore } from './firestore-service.js';
import { showNotification, render } from './ui.js';

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
    const initialBalanceDate = document.getElementById('acc-date').value;
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

    document.getElementById('edit-acc-id').value = acc.id;
    document.getElementById('edit-acc-name').value = acc.name;
    document.getElementById('edit-acc-balance').value = acc.initialBalance;
    document.getElementById('edit-acc-date').value = acc.initialBalanceDate;
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
    // ... implementation for update ...
};

/**
 * Renders the list of accounts in the settings view.
 * Disables the delete button for accounts that are in use.
 */
export const renderAccountsList = () => {
    const container = document.getElementById('mgmt-accounts-list');
    if (!container || !state.transactions || !state.recurringTemplates) return;

    const usedAccountIds = new Set();
    // Check all transactions
    state.transactions.forEach(tx => {
        if (tx.source) usedAccountIds.add(tx.source);
        if (tx.destination) usedAccountIds.add(tx.destination);
    });
    // Check all recurring templates
    state.recurringTemplates.forEach(tpl => {
        if (tpl.source) usedAccountIds.add(tpl.source);
        if (tpl.destination) usedAccountIds.add(tpl.destination);
    });

    const sortedAccounts = [...state.accounts].sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = sortedAccounts.map(acc => {
        const isUsed = usedAccountIds.has(acc.id);
        const disabledTitle = "Ce compte est utilisé et ne peut pas être supprimé.";

        return `
            <li data-id="${acc.id}" class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500"><i class="fa-solid fa-landmark"></i></div>
                    <span class="font-medium">${acc.name}</span>
                </div>
                <div class="opacity-0 group-hover:opacity-100">
                    <button onclick="window.app.openEditAccount('${acc.id}')" class="p-1 text-slate-500 hover:text-blue-600" title="Éditer le compte">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="window.app.deleteAccount('${acc.id}')" class="p-1 text-slate-500 hover:text-red-600 disabled:text-slate-300 disabled:cursor-not-allowed" ${isUsed ? `disabled title="${disabledTitle}"` : 'title="Supprimer le compte"'}>
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </li>`;
    }).join('');
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
        render(); // Re-render to fix the UI state if it was incorrect
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