import { state } from './state.js';
import { generateId, formatCurrency } from './utils.js';
import { currentUserId } from './storage.js';
import { addAccountToFirestore, updateAccountInFirestore, deleteAccountFromFirestore } from './firestore-service.js';
import { showNotification, render } from './ui.js';

export const renderAccountsList = () => {
    const container = document.getElementById('mgmt-accounts-list');
    container.innerHTML = state.accounts.map(acc => `
        <li class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-piggy-bank text-blue-500"></i>
                <div class="flex flex-col">
                    <span class="font-medium">${acc.name}</span>
                    <span class="text-xs text-slate-400">Solde init: ${formatCurrency(acc.initialBalance)} le ${acc.initialBalanceDate}</span>
                </div>
                ${acc.isSavings ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Épargne</span>' : ''}
            </div>
            <div class="opacity-0 group-hover:opacity-100">
                <button onclick="window.app.openEditAccount('${acc.id}')" class="p-1"><i class="fa-solid fa-pen"></i></button>
                <button onclick="window.app.deleteAccount('${acc.id}')" class="p-1"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </li>`).join('');
};

export const openAddAccountDrawer = () => {
    document.getElementById('add-account-form').reset();
    document.getElementById('acc-balance-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('drawer-overlay').classList.add('active');
    document.getElementById('account-add-drawer').classList.add('active');
};

export const closeAddAccountDrawer = () => {
    document.getElementById('drawer-overlay').classList.remove('active');
    document.getElementById('account-add-drawer').classList.remove('active');
    document.getElementById('add-account-form').reset();
};

export const handleAddAccount = async (e) => {
    e.preventDefault();
    const name = document.getElementById('acc-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('acc-balance').value);
    const initialBalanceDate = document.getElementById('acc-balance-date').value;
    const isSavings = document.getElementById('acc-is-savings').checked;

    if (!name || !initialBalanceDate) return;

    if (state.accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) {
        showNotification(`Un compte avec le nom "${name}" existe déjà.`, 'error');
        return;
    }

    const id = `acc_${generateId()}`;
    const newAccount = { id, name, initialBalance, initialBalanceDate, isSavings };
    
    try {
        await addAccountToFirestore(currentUserId, newAccount);
        closeAddAccountDrawer();
        showNotification('Compte ajouté !');
    } catch (err) {
        showNotification("Erreur lors de l'ajout", 'error');
    }
};

export const openEditAccount = (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;

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
    document.getElementById('edit-account-form').reset();
};

export const handleUpdateAccount = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-acc-id').value;
    const name = document.getElementById('edit-acc-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('edit-acc-balance').value);
    const initialBalanceDate = document.getElementById('edit-acc-balance-date').value;
    const isSavings = document.getElementById('edit-acc-is-savings').checked;

    if (state.accounts.some(a => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) {
        showNotification(`Un autre compte porte déjà le nom "${name}".`, 'error');
        return;
    }

    try {
        await updateAccountInFirestore(currentUserId, { id, name, initialBalance, initialBalanceDate, isSavings });
        closeAccountDrawer();
        showNotification('Compte mis à jour !');
    } catch (err) {
        showNotification('Erreur de mise à jour', 'error');
    }
};

export const deleteAccount = async (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce compte ? Les transactions associées ne seront pas supprimées automatiquement pour conserver l\'historique.')) {
        try {
            await deleteAccountFromFirestore(currentUserId, id);
            showNotification('Compte supprimé.');
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    }
};
