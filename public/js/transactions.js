import { state } from './state.js';
import { generateId, getMonthKey, getTxDisplayInfo } from './utils.js';
import { currentUserId } from './storage.js';
import { 
    addTransactionToFirestore, 
    updateTransactionInFirestore, 
    deleteTransactionFromFirestore, 
    addRecurringTemplate,
    updateRecurringSeriesInFirestore,
    deleteRecurringSeriesInFirestore,
    generateJitTransactions
} from './firestore-service.js';
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
    
    // Default visibility
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
            
            // Trigger change to update visibility
            document.getElementById('transaction-type').dispatchEvent(new Event('change'));

            // Handle recurring fields visibility and population
            const isRecurringCheckbox = document.getElementById('transaction-is-recurring');
            const recurringFields = document.getElementById('recurring-fields');
            
            if (tx.isRecurringInst) {
                isRecurringCheckbox.checked = true;
                recurringFields.classList.remove('hidden');
                
                // Find the associated template to populate recurring fields
                const template = state.recurring.find(r => r.id === tx.parentId);
                if (template) {
                    document.getElementById('transaction-periodicity').value = template.periodicity || 'M';
                    document.getElementById('transaction-end-month').value = template.endMonth || '';
                }
            }
        }
    } else {
        document.getElementById('transaction-modal-title').textContent = 'Ajouter une transaction';
        document.getElementById('transaction-edit-id').value = '';
        document.getElementById('transaction-date').value = new Date().toISOString().substring(0, 10);
        document.getElementById('transaction-end-month').value = '';
        document.getElementById('transaction-periodicity').value = 'M';
    }
    
    modal.classList.remove('hidden');
};

export const closeTransactionModal = () => {
    document.getElementById('transaction-modal').classList.add('hidden');
};

const showRecurringChoiceModal = (title, message, btnAllText) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('recurring-choice-modal');
        const btnAll = document.getElementById('btn-choice-all');
        const btnSingle = document.getElementById('btn-choice-single');
        const btnCancel = document.getElementById('btn-choice-cancel');

        modal.querySelector('h2').textContent = title;
        modal.querySelector('p').textContent = message;
        btnAll.textContent = btnAllText;

        const cleanup = (choice) => {
            modal.classList.add('hidden');
            btnAll.removeEventListener('click', onAll);
            btnSingle.removeEventListener('click', onSingle);
            btnCancel.removeEventListener('click', onCancel);
            resolve(choice);
        };

        const onAll = () => cleanup('all');
        const onSingle = () => cleanup('single');
        const onCancel = () => cleanup('cancel');

        btnAll.addEventListener('click', onAll);
        btnSingle.addEventListener('click', onSingle);
        btnCancel.addEventListener('click', onCancel);

        modal.classList.remove('hidden');
    });
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
    const periodicity = document.getElementById('transaction-periodicity').value;
    const endMonth = document.getElementById('transaction-end-month').value;

    if (!label || !amount || !date || !category || !sourceId || !destinationId) {
        showNotification('Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }

    try {
        if (isRecurring && !id) {
            // Create a new recurring template
            const template = {
                id: `rec_${generateId()}`,
                label,
                amount,
                sourceId,
                destinationId,
                category,
                anchorDate: date,
                startMonth: date.substring(0, 7),
                endMonth: endMonth || null,
                periodicity
            };
            await addRecurringTemplate(currentUserId, template);
            showNotification('Transaction récurrente configurée !');
        } else if (id) {
            // Update existing transaction instance
            const currentMonthKey = getMonthKey(state.viewDate);
            const tx = state.records[currentMonthKey]?.items.find(t => t.id === id);
            
            if (tx && tx.isRecurringInst) {
                const choice = await showRecurringChoiceModal(
                    'Mise à jour d\'une transaction récurrente',
                    'Souhaitez-vous appliquer cette modification à toutes les occurrences futures de cette transaction récurrente ou seulement à celle-ci ?',
                    'Appliquer à la série (Split & Update)'
                );
                if (choice === 'cancel') return;
                
                if (choice === 'all') {
                    // Update the entire series: Split & Create new template version
                    await updateRecurringSeriesInFirestore(currentUserId, tx.parentId, currentMonthKey, {
                        label, amount, category, sourceId, destinationId,
                        anchorDate: date, periodicity, endMonth: endMonth || null
                    });
                    showNotification('Série de transactions mise à jour !');
                } else {
                    // Update only this instance
                    await updateTransactionInFirestore(currentUserId, { id, label, amount, date, category, sourceId, destinationId });
                    showNotification('Transaction modifiée !');
                }
            } else {
                // Update normal transaction
                await updateTransactionInFirestore(currentUserId, { id, label, amount, date, category, sourceId, destinationId });
                showNotification('Transaction modifiée !');
            }
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
    const currentMonthKey = getMonthKey(state.viewDate);
    const tx = state.records[currentMonthKey]?.items.find(t => t.id === id);
    
    if (!tx) return;

    if (tx.isRecurringInst) {
        const choice = await showRecurringChoiceModal(
            'Suppression d\'une transaction récurrente',
            'Souhaitez-vous supprimer toutes les occurrences futures de cette série ou seulement cette transaction ?',
            'Supprimer la série future'
        );
        
        if (choice === 'cancel') return;
        
        try {
            if (choice === 'all') {
                await deleteRecurringSeriesInFirestore(currentUserId, tx.parentId, currentMonthKey);
                showNotification('Série future supprimée.');
            } else {
                await deleteTransactionFromFirestore(currentUserId, id);
                showNotification('Transaction supprimée.');
            }
        } catch (err) {
            showNotification('Erreur de suppression', 'error');
        }
    } else {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
            try {
                await deleteTransactionFromFirestore(currentUserId, id);
                showNotification('Transaction supprimée.');
            } catch (err) {
                showNotification('Erreur de suppression', 'error');
            }
        }
    }
};
