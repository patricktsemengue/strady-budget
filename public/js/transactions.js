import { state } from './state.js';
import { generateId, getMonthKey, getTxDisplayInfo, generateDeterministicTransactionId, generateDeterministicTemplateId } from './utils.js';
import { currentUserId } from './storage.js';
import { 
    addTransactionToFirestore, 
    deleteTransactionFromFirestore, 
    addRecurringTemplate,
    updateSingleTransactionInFirestore,
    updateRecurringSeriesInFirestore,
    deleteRecurringSeriesInFirestore
} from './firestore-service.js';
import { showNotification } from './ui.js';
import { router } from './app-router.js';

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

    const tx = id ? state.records[getMonthKey(state.viewDate)]?.items.find(t => t.id === id) : null;

    if (id) { // EDIT MODE
        document.getElementById('transaction-modal-title').textContent = 'Éditer la transaction';
        document.getElementById('transaction-edit-id').value = id;
    } else { // NEW MODE
        document.getElementById('transaction-modal-title').textContent = 'Ajouter une transaction';
        document.getElementById('transaction-edit-id').value = '';
    }

    if (tx) { // Pre-fill for EDIT
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

    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = false;

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
                if (confirm("Vous modifiez une transaction récurrente. Cette action va supprimer l'ancienne série et en créer une nouvelle avec ces paramètres. Continuer ?")) {
                    // RECURRING UPDATE: delete-old and create-new
                    const newTemplateValues = { 
                        date, label, amount, source, destination, category: Category,
                        recurring: true, endDate, periodicity
                    };
                    await updateRecurringSeriesInFirestore(currentUserId, tx.Model, newTemplateValues);
                    showNotification('Série récurrente mise à jour.');
                } else {
                    return; // User cancelled
                }
            } else {
                if (confirm("Êtes-vous sûr de vouloir modifier cette transaction ?")) {
                    // SINGLE UPDATE: delete-old and create-new
                    const newTxData = { label, amount, date, Category, source, destination, Model: null };
                    await updateSingleTransactionInFirestore(currentUserId, id, newTxData);
                    showNotification('Transaction mise à jour.');
                } else {
                    return; // User cancelled
                }
            }
        } else {
            // CREATION CASE
            if (isRecurring) {
                // RECURRING CREATION: Align with TODO.litcoffee
                const templateData = {
                    date, label, amount, source, destination, category: Category,
                    recurring: true, endDate, periodicity
                };
                const templateId = generateDeterministicTemplateId(templateData);

                // Check if template already exists
                const existingTemplate = state.recurringTemplates.find(tpl => tpl.id === templateId);
                if (existingTemplate) {
                    showNotification('Cette série récurrente existe déjà.', 'error');
                    return;
                }

                await addRecurringTemplate(currentUserId, {
                    id: templateId,
                    ...templateData
                });
                showNotification('Transaction récurrente créée !');
            } else {
                // SINGLE CREATION: Align with TODO.litcoffee
                const newTxData = { label, amount, date, Category, source, destination, Model: null };
                const newId = generateDeterministicTransactionId(newTxData);

                // Check if transaction already exists
                const existingTx = Object.values(state.records).flatMap(r => r.items).find(t => t.id === newId);
                if (existingTx) {
                    showNotification('Cette transaction existe déjà.', 'error');
                    return;
                }

                await addTransactionToFirestore(currentUserId, {
                    id: newId, ...newTxData
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

let currentMobileActionId = null;

export const openMobileActions = (id) => {
    const onFocusMonthKey = getMonthKey(state.viewDate);
    const tx = state.records[onFocusMonthKey]?.items.find(t => t.id === id);
    if (!tx) return;

    currentMobileActionId = id;
    const modal = document.getElementById('mobile-actions-modal');
    const content = document.getElementById('mobile-actions-content');
    const title = document.getElementById('mobile-actions-title');

    title.textContent = tx.label;
    modal.classList.remove('hidden');
    
    // Animation
    setTimeout(() => {
        content.style.transform = 'translateY(0)';
    }, 10);

    // Setup action button listeners (once)
    const setupAction = (btnId, actionFn) => {
        const btn = document.getElementById(btnId);
        btn.onclick = () => {
            closeMobileActions();
            actionFn(currentMobileActionId);
        };
    };

    setupAction('mobile-action-edit', editTransaction);
    setupAction('mobile-action-delete', deleteTransaction);

    // Close on overlay click
    modal.onclick = (e) => {
        if (e.target === modal) closeMobileActions();
    };
};

export const closeMobileActions = () => {
    const modal = document.getElementById('mobile-actions-modal');
    const content = document.getElementById('mobile-actions-content');
    
    content.style.transform = 'translateY(100%)';
    setTimeout(() => {
        modal.classList.add('hidden');
        currentMobileActionId = null;
    }, 300);
};
