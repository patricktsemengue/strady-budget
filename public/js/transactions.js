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
    // Align with TODO.litcoffee: Default value = "" to indicates external account
    const accountOptions = state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    sourceSelect.innerHTML = `<option value="">Externe (Revenu)</option>${accountOptions}`;
    destSelect.innerHTML = `<option value="">Externe (Dépense)</option>${accountOptions}`;
    
    // Default visibility
    document.getElementById('recurring-fields').classList.add('hidden');
    document.getElementById('transaction-is-recurring').checked = false;

    if (id) {
        document.getElementById('transaction-modal-title').textContent = 'Éditer la transaction';
        document.getElementById('transaction-edit-id').value = id;

        const monthKey = getMonthKey(state.viewDate);
        const tx = state.records[monthKey]?.items.find(t => t.id === id);

        if (tx) {
            document.getElementById('transaction-label').value = tx.label || '';
            document.getElementById('transaction-amount').value = tx.amount || 0;
            if (tx.date) {
                document.getElementById('transaction-date').value = tx.date.substring(0, 10);
            } else {
                document.getElementById('transaction-date').value = new Date().toISOString().substring(0, 10);
            }
            categorySelect.value = tx.Category || tx.category || '';
            sourceSelect.value = tx.source || tx.sourceId || '';
            destSelect.value = tx.destination || tx.destinationId || '';

            const isRecurring = !!tx.Model;
            const isRecurringCheckbox = document.getElementById('transaction-is-recurring');
            const recurringFields = document.getElementById('recurring-fields');
            
            if (isRecurring) {
                isRecurringCheckbox.checked = true;
                recurringFields.classList.remove('hidden');
                
                // Find the associated template
                const template = state.recurringTemplates.find(r => r.id === tx.Model);
                if (template) {
                    document.getElementById('transaction-periodicity').value = template.periodicity || 'M';
                    document.getElementById('transaction-end-date').value = template.endDate || '';
                }
            }
        }
    } else {
        document.getElementById('transaction-modal-title').textContent = 'Ajouter une transaction';
        document.getElementById('transaction-edit-id').value = '';
        // Defaults from TODO.litcoffee
        document.getElementById('transaction-date').value = new Date().toISOString().substring(0, 10);
        document.getElementById('transaction-amount').value = 0;
        document.getElementById('transaction-periodicity').value = 'M';
        document.getElementById('transaction-end-date').value = '';

        // Category defaulting logic based on initial empty source/destination
        // Since both are empty by default, we need to pick a default. 
        // Let's default to "Dépense" (source = account, destination = external) for new ones?
        // Actually, the spec says:
        // "Category. Default value =
        //  * "Revenu" if source is empty
        //  * "Autre" if destination is empty"
        // Let's set an initial state that makes sense.
        if (state.accounts.length > 0) {
            sourceSelect.value = state.accounts[0].id;
            destSelect.value = "";
            // Default category for this state would be "Autre" (destination is empty)
            const autreCat = state.categories.find(c => c.label === "Autre");
            if (autreCat) categorySelect.value = autreCat.id;
        }
    }
    
    // Add event listeners for dynamic category defaulting
    const updateDefaultCategory = () => {
        const source = sourceSelect.value;
        const destination = destSelect.value;
        if (source === "" && destination !== "") {
            const revenuCat = state.categories.find(c => c.label === "Revenu");
            if (revenuCat) categorySelect.value = revenuCat.id;
        } else if (destination === "" && source !== "") {
            const autreCat = state.categories.find(c => c.label === "Autre");
            if (autreCat) categorySelect.value = autreCat.id;
        }
    };

    sourceSelect.onchange = updateDefaultCategory;
    destSelect.onchange = updateDefaultCategory;

    // Recurring checkbox toggle
    document.getElementById('transaction-is-recurring').onchange = (e) => {
        document.getElementById('recurring-fields').classList.toggle('hidden', !e.target.checked);
    };

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
    const Category = document.getElementById('transaction-category').value;
    const source = document.getElementById('transaction-source').value;
    const destination = document.getElementById('transaction-destination').value;
    
    const isRecurring = document.getElementById('transaction-is-recurring').checked;
    const periodicity = document.getElementById('transaction-periodicity').value;
    const endDate = document.getElementById('transaction-end-date').value || null;

    // Validation from TODO.litcoffee
    if (!label || isNaN(amount) || !date || !Category) {
        showNotification('Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }

    if (source === "" && destination === "") {
        showNotification('La source et la destination ne peuvent pas être vides simultanément.', 'error');
        return;
    }

    try {
        const onFocusMonthKey = getMonthKey(state.viewDate);

        if (id) {
            // UPDATE CASE
            const tx = state.records[onFocusMonthKey]?.items.find(t => t.id === id);
            
            if (tx && tx.Model) {
                if (confirm("Vous modifiez une transaction récurrente. Pour préserver l'historique, cela va mettre fin à l'ancienne série et en créer une nouvelle à partir de cette date. Continuer ?")) {
                    // RECURRING UPDATE: Align with TODO.litcoffee
                    const newTemplateValues = {
                        date, label, amount, source, destination, category: Category,
                        recurring: true, endDate, periodicity
                    };
                    await updateRecurringSeriesInFirestore(currentUserId, tx.Model, onFocusMonthKey, newTemplateValues);
                    showNotification('Série récurrente mise à jour (Split).');
                } else {
                    return; // User cancelled
                }
            } else {
                if (confirm("Êtes-vous sûr de vouloir remplacer cette transaction ? Cette action supprime l'ancienne et en crée une nouvelle.")) {
                    // SINGLE UPDATE: Align with TODO.litcoffee
                    // "deletes the old transaction, and creates a new transaction"
                    await deleteTransactionFromFirestore(currentUserId, id);
                    await addTransactionToFirestore(currentUserId, {
                        id: generateId(), label, amount, date, Category, source, destination, Model: null
                    });
                    showNotification('Transaction mise à jour (Remplacée).');
                } else {
                    return; // User cancelled
                }
            }
        } else {
            // CREATION CASE
            if (isRecurring) {
                // RECURRING CREATION: Align with TODO.litcoffee
                const template = {
                    id: `rec_${generateId()}`,
                    date, label, amount, source, destination, category: Category,
                    recurring: true, endDate, periodicity
                };
                await addRecurringTemplate(currentUserId, template);
                showNotification('Transaction récurrente créée !');
            } else {
                // SINGLE CREATION: Align with TODO.litcoffee
                await addTransactionToFirestore(currentUserId, {
                    id: generateId(), label, amount, date, Category, source, destination, Model: null
                });
                showNotification('Transaction ajoutée !');
            }
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

    if (tx.Model) {
        // RECURRING DELETION: Align with TODO.litcoffee
        // "deletes the template and linked transactions"
        if (confirm('Voulez-vous supprimer cette transaction récurrente ET toutes les transactions liées ? (Action irréversible)')) {
            try {
                await deleteRecurringSeriesInFirestore(currentUserId, tx.Model);
                showNotification('Série récurrente supprimée.');
            } catch (err) {
                showNotification('Erreur de suppression', 'error');
            }
        }
    } else {
        // SINGLE DELETION: Align with TODO.litcoffee
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
