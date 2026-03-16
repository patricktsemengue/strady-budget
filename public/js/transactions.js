import { state } from './state.js';
import { generateId, getMonthKey, getTxDisplayInfo } from './utils.js';
import { currentUserId } from './storage.js';
import { addTransactionToFirestore, updateTransactionInFirestore, deleteTransactionFromFirestore, addRecurringTemplate } from './firestore-service.js';
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
    
    // Hide recurring fields by default
    document.getElementById('recurring-fields').classList.add('hidden');
    document.getElementById('transaction-is-recurring').checked = false;

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
            
            // If it's a recurring instance, we show it's linked but don't allow converting back to template here for simplicity
            if (tx.isRecurringInst) {
                // For now, editing a recurring instance only edits that specific instance.
                // We could add "Edit all future" logic later.
            }

            // Trigger change to update visibility
            document.getElementById('transaction-type').dispatchEvent(new Event('change'));
        }
    } else {
        document.getElementById('transaction-modal-title').textContent = 'Ajouter une transaction';
        document.getElementById('transaction-edit-id').value = '';
        document.getElementById('transaction-date').value = new Date().toISOString().substring(0, 10);
        document.getElementById('transaction-start-month').value = new Date().toISOString().substring(0, 7);
    }
    
    modal.classList.remove('hidden');
};

export const closeTransactionModal = () => {
    document.getElementById('transaction-modal').classList.add('hidden');
};

export const handleSaveTransaction = async (e) => {
    e.preventDefault();
    const id = document.getElementById('transaction-edit-id').value;
    const label = document.getElementById('transaction-label').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const date = document.getElementById('transaction-date').value;
    const category = document.getElementById('transaction-category').value;
    const sourceId = document.getElementById('transaction-source').value;
    const destinationId = document.getElementById('transaction-destination').value;
    
    const isRecurring = document.getElementById('transaction-is-recurring').checked;
    const startMonth = document.getElementById('transaction-start-month').value;
    const endMonth = document.getElementById('transaction-end-month').value;

    if (!label || !amount || (isRecurring ? !startMonth : !date) || !category || !sourceId || !destinationId) {
        showNotification('Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }

    try {
        if (isRecurring && !id) {
            // Create a new recurring template (which generates instances)
            const template = {
                id: `rec_${generateId()}`,
                label,
                amount,
                sourceId,
                destinationId,
                category,
                startMonth,
                endMonth: endMonth || null,
                periodicity: 'M'
            };
            await addRecurringTemplate(currentUserId, template);
            showNotification('Transaction récurrente configurée !');
        } else if (id) {
            // Update existing transaction instance
            await updateTransactionInFirestore(currentUserId, { id, label, amount, date, category, sourceId, destinationId });
            showNotification('Transaction modifiée !');
        } else {
            // Create a standard single transaction
            await addTransactionToFirestore(currentUserId, { id: generateId(), label, amount, date, category, sourceId, destinationId });
            showNotification('Transaction ajoutée !');
        }
        closeTransactionModal();
    } catch (err) {
        console.error(err);
        showNotification('Erreur de sauvegarde', 'error');
    }
};

export const editTransaction = (id) => {
    openTransactionModal(id);
};

export const duplicateTransaction = async (id) => {
    const monthKey = getMonthKey(state.viewDate);
    const transaction = state.records[monthKey]?.items.find(item => item.id === id);
    if (transaction) {
        try {
            const newTransaction = { ...transaction, id: generateId() };
            // Ensure we don't accidentally copy system fields or specific recursive IDs if we added any
            delete newTransaction.updated_at; 
            await addTransactionToFirestore(currentUserId, newTransaction);
            showNotification('Transaction dupliquée.');
        } catch (err) {
            showNotification('Erreur de duplication', 'error');
        }
    }
};

export const deleteTransaction = async (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
        try {
            await deleteTransactionFromFirestore(currentUserId, id);
            showNotification('Transaction supprimée.');
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    }
};
