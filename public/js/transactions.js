import { state } from './state.js';
import { generateId, getMonthKey, getTxDisplayInfo } from './utils.js';
import { saveState } from './storage.js';
import { showNotification, render } from './ui.js';

export const openTransactionModal = (id = null) => {
    const modal = document.getElementById('transaction-modal');
    const form = document.getElementById('transaction-form');
    form.reset();

    const categorySelect = document.getElementById('transaction-category');
    categorySelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');

    const sourceSelect = document.getElementById('transaction-source');
    const destSelect = document.getElementById('transaction-destination');
    const accountOptions = state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    sourceSelect.innerHTML = `<option value="external">Externe</option>${accountOptions}`;
    destSelect.innerHTML = `<option value="external">Externe</option>${accountOptions}`;
    
    if (id) {
        document.getElementById('transaction-modal-title').textContent = 'Éditer la transaction';
        document.getElementById('transaction-edit-id').value = id;

        const monthKey = getMonthKey(state.viewDate);
        const tx = state.records[monthKey]?.items.find(t => t.id === id);

        if (tx) {
            document.getElementById('transaction-label').value = tx.label;
            document.getElementById('transaction-amount').value = tx.amount;
            document.getElementById('transaction-date').value = tx.date.substring(0, 10);
            categorySelect.value = tx.category;
            sourceSelect.value = tx.sourceId;
            destSelect.value = tx.destinationId;

            const txInfo = getTxDisplayInfo(tx.sourceId, tx.destinationId);
            let type = 'transfer';
            if (txInfo.isIncome) type = 'income';
            if (txInfo.isExpense) type = 'expense';
            document.getElementById('transaction-type').value = type;
            
            // Trigger change to update visibility
            document.getElementById('transaction-type').dispatchEvent(new Event('change'));
        }
    } else {
        document.getElementById('transaction-modal-title').textContent = 'Ajouter une transaction';
        document.getElementById('transaction-edit-id').value = '';
        document.getElementById('transaction-date').value = new Date().toISOString().substring(0, 10);
    }
    
    modal.classList.remove('hidden');
};

export const closeTransactionModal = () => {
    document.getElementById('transaction-modal').classList.add('hidden');
};

export const handleSaveTransaction = (e) => {
    e.preventDefault();
    const id = document.getElementById('transaction-edit-id').value;
    const label = document.getElementById('transaction-label').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const date = document.getElementById('transaction-date').value;
    const category = document.getElementById('transaction-category').value;
    const sourceId = document.getElementById('transaction-source').value;
    const destinationId = document.getElementById('transaction-destination').value;

    if (!label || !amount || !date || !category || !sourceId || !destinationId) {
        showNotification('Veuillez remplir tous les champs.', 'error');
        return;
    }

    const monthKey = getMonthKey(new Date(date));
    if (!state.records[monthKey]) {
        state.records[monthKey] = { items: [] };
    }

    const transactionData = { label, amount, date, category, sourceId, destinationId };

    if (id) {
        const originalMonthKey = getMonthKey(state.viewDate);
        const txIndex = state.records[originalMonthKey]?.items.findIndex(t => t.id === id);

        if (txIndex !== -1) {
            if (originalMonthKey === monthKey) {
                state.records[monthKey].items[txIndex] = { ...state.records[monthKey].items[txIndex], ...transactionData };
            } else {
                const [movedTx] = state.records[originalMonthKey].items.splice(txIndex, 1);
                state.records[monthKey].items.push({ ...movedTx, ...transactionData });
            }
            showNotification('Transaction modifiée !');
        }
    } else {
        state.records[monthKey].items.push({ id: generateId(), ...transactionData });
        showNotification('Transaction ajoutée !');
    }

    saveState();
    render();
    closeTransactionModal();
};

export const editTransaction = (id) => {
    openTransactionModal(id);
};

export const duplicateTransaction = (id) => {
    const monthKey = getMonthKey(state.viewDate);
    if (state.records[monthKey]) {
        const transaction = state.records[monthKey].items.find(item => item.id === id);
        if (transaction) {
            const newTransaction = { ...transaction, id: generateId() };
            state.records[monthKey].items.push(newTransaction);
            saveState();
            render();
            showNotification('Transaction dupliquée.');
        }
    }
};

export const deleteTransaction = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
        const monthKey = getMonthKey(state.viewDate);
        if (state.records[monthKey]) {
            state.records[monthKey].items = state.records[monthKey].items.filter(item => item.id !== id);
            saveState();
            render();
            showNotification('Transaction supprimée.');
        }
    }
};
