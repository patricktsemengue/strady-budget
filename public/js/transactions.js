import { state } from './state.js';
import { generateId, getMonthKey, getTxDisplayInfo, generateDeterministicTransactionId, generateDeterministicTemplateId, formatCurrency } from './utils.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';
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
    sourceSelect.innerHTML = `<option value="">${t('transactions.external_income')}</option>${accountOptions}`;
    destSelect.innerHTML = `<option value="">${t('transactions.external_expense')}</option>${accountOptions}`;
    
    // Default visibility
    const recurringFields = document.getElementById('recurring-fields');
    if (recurringFields) recurringFields.classList.add('hidden');
    const isRecurringCheckbox = document.getElementById('transaction-is-recurring');
    if (isRecurringCheckbox) isRecurringCheckbox.checked = false;

    const tx = id ? state.records[getMonthKey(state.viewDate)]?.items.find(t => t.id === id) : null;

    if (id) { // EDIT MODE
        const modalTitle = document.getElementById('transaction-modal-title');
        if (modalTitle) modalTitle.textContent = t('transactions.modal_edit_title');
        const editIdInput = document.getElementById('transaction-edit-id');
        if (editIdInput) editIdInput.value = id;
    } else { // NEW MODE
        const modalTitle = document.getElementById('transaction-modal-title');
        if (modalTitle) modalTitle.textContent = t('transactions.modal_add_title');
        const editIdInput = document.getElementById('transaction-edit-id');
        if (editIdInput) editIdInput.value = '';
    }

    if (tx) { // Pre-fill for EDIT
        const labelInput = document.getElementById('transaction-label');
        if (labelInput) labelInput.value = tx.label || '';
        const amountInput = document.getElementById('transaction-amount');
        if (amountInput) amountInput.value = tx.amount || 0;
        const dateInput = document.getElementById('transaction-date');
        if (dateInput) {
            if (tx.date) {
                dateInput.value = tx.date.substring(0, 10);
            } else {
                dateInput.value = new Date().toISOString().substring(0, 10);
            }
        }
        categorySelect.value = tx.Category || tx.category || '';
        sourceSelect.value = tx.source || tx.sourceId || '';
        destSelect.value = tx.destination || tx.destinationId || '';

        const isRecurring = !!tx.Model;
        const isRecurringCheckbox = document.getElementById('transaction-is-recurring');
        const recurringFields = document.getElementById('recurring-fields');
        
        if (isRecurring) {
            if (isRecurringCheckbox) isRecurringCheckbox.checked = true;
            if (recurringFields) recurringFields.classList.remove('hidden');
            
            // Find the associated template
            const template = state.recurringTemplates.find(r => r.id === tx.Model);
            if (template) {
                const periodicityInput = document.getElementById('transaction-periodicity');
                if (periodicityInput) periodicityInput.value = template.periodicity || 'M';
                const endDateInput = document.getElementById('transaction-end-date');
                if (endDateInput) endDateInput.value = template.endDate || '';
            }
        }
    } else {
        const modalTitle = document.getElementById('transaction-modal-title');
        if (modalTitle) modalTitle.textContent = t('transactions.modal_add_title');
        const editIdInput = document.getElementById('transaction-edit-id');
        if (editIdInput) editIdInput.value = '';
        // Defaults from TODO.litcoffee
        const dateInput = document.getElementById('transaction-date');
        if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);
        const amountInput = document.getElementById('transaction-amount');
        if (amountInput) amountInput.value = 0;
        const periodicityInput = document.getElementById('transaction-periodicity');
        if (periodicityInput) periodicityInput.value = 'M';
        const endDateInput = document.getElementById('transaction-end-date');
        if (endDateInput) endDateInput.value = '';

        // Default category for this state would be "Autre" (destination is empty)
        const autreCat = state.categories.find(c => c.label.toLowerCase().includes('autre'));
        if (autreCat) categorySelect.value = autreCat.id;

        if (state.accounts.length > 0) {
            sourceSelect.value = state.accounts[0].id;
            destSelect.value = "";
        }
    }
    
    // Add event listeners for dynamic category defaulting
    const updateDefaultCategory = () => {
        const source = sourceSelect.value;
        const destination = destSelect.value;
        const isSrcExt = source === "" || source === "external";
        const isDstExt = destination === "" || destination === "external";

        if (isSrcExt && !isDstExt) {
            const revenuCat = state.categories.find(c => c.nature === "REVENU");
            if (revenuCat) categorySelect.value = revenuCat.id;
        } else if (!isSrcExt && isDstExt) {
            const quotidienCat = state.categories.find(c => c.nature === "QUOTIDIEN");
            if (quotidienCat) categorySelect.value = quotidienCat.id;
        }
    };

    sourceSelect.onchange = updateDefaultCategory;
    destSelect.onchange = updateDefaultCategory;

    // Recurring checkbox toggle
    const recurringCheckbox = document.getElementById('transaction-is-recurring');
    if (recurringCheckbox) {
        recurringCheckbox.onchange = (e) => {
            const fields = document.getElementById('recurring-fields');
            if (fields) fields.classList.toggle('hidden', !e.target.checked);
        };
    }

    const saveButton = form.querySelector('button[type="submit"]');
    if (saveButton) saveButton.disabled = false;

    if (modal) modal.classList.remove('hidden');
};

export const closeTransactionModal = () => {
    const modal = document.getElementById('transaction-modal');
    if (modal) modal.classList.add('hidden');
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
        showNotification(t('transactions.error_empty_fields'), 'error');
        return;
    }

    if (source === "" && destination === "") {
        showNotification(t('transactions.error_both_external'), 'error');
        return;
    }

    // Restriction: transaction cannot be before account creation date (TODO.md)
    const sourceAcc = state.accounts.find(a => a.id === source);
    const destAcc = state.accounts.find(a => a.id === destination);

    if (sourceAcc && date < (sourceAcc.createDate || sourceAcc.initialBalanceDate)) {
        showNotification(`${t('transactions.error_before_creation')} (${sourceAcc.createDate || sourceAcc.initialBalanceDate}).`, 'error');
        return;
    }
    if (destAcc && date < (destAcc.createDate || destAcc.initialBalanceDate)) {
        showNotification(`${t('transactions.error_before_creation')} (${destAcc.createDate || destAcc.initialBalanceDate}).`, 'error');
        return;
    }

    try {
        const onFocusMonthKey = getMonthKey(state.viewDate);

        if (id) {
            // UPDATE CASE
            const tx = state.records[onFocusMonthKey]?.items.find(t => t.id === id);
            
            if (tx && tx.Model) {
                if (confirm(t('confirm.edit_recurring'))) {
                    // RECURRING UPDATE: delete-old and create-new
                    const newTemplateValues = { 
                        date, label, amount, source, destination, category: Category,
                        recurring: true, endDate, periodicity
                    };
                    await updateRecurringSeriesInFirestore(currentUserId, tx.Model, newTemplateValues);
                    showNotification(t('transactions.success_recurring_updated'));
                } else {
                    return; // User cancelled
                }
            } else {
                if (confirm(t('confirm.edit_tx'))) {
                    // SINGLE UPDATE: delete-old and create-new
                    const newTxData = { label, amount, date, Category, source, destination, Model: null };
                    await updateSingleTransactionInFirestore(currentUserId, id, newTxData);
                    showNotification(t('transactions.success_tx_updated'));
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
                    showNotification(t('transactions.error_duplicate_recurring'), 'error');
                    return;
                }

                await addRecurringTemplate(currentUserId, {
                    id: templateId,
                    ...templateData
                });
                showNotification(t('transactions.success_recurring_created'));
            } else {
                // SINGLE CREATION: Align with TODO.litcoffee
                const newTxData = { label, amount, date, Category, source, destination, Model: null };
                const newId = generateDeterministicTransactionId(newTxData);

                // Check if transaction already exists
                const existingTx = Object.values(state.records).flatMap(r => r.items).find(t => t.id === newId);
                if (existingTx) {
                    showNotification(t('transactions.error_duplicate_tx'), 'error');
                    return;
                }

                await addTransactionToFirestore(currentUserId, {
                    id: newId, ...newTxData
                });
                showNotification(t('transactions.success_tx_created'));
            }
        }
        closeTransactionModal();
    } catch (err) {
        console.error(err);
        showNotification(t('transactions.error_save'), 'error');
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
        if (confirm(t('confirm.delete_recurring'))) {
            try {
                await deleteRecurringSeriesInFirestore(currentUserId, tx.Model);
                showNotification(t('transactions.success_recurring_deleted'));
            } catch (err) {
                showNotification(t('transactions.error_delete'), 'error');
            }
        }
    } else {
        if (confirm(t('confirm.delete_tx'))) {
            try {
                await deleteTransactionFromFirestore(currentUserId, id);
                showNotification(t('transactions.success_tx_deleted'));
            } catch (err) {
                showNotification(t('transactions.error_delete'), 'error');
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

    const txInfo = getTxDisplayInfo(tx.source, tx.destination);
    const category = state.categories.find(c => c.id === tx.Category);
    const formattedAmount = formatCurrency(tx.amount);

    title.innerHTML = `
        <div class="flex items-center gap-4 text-left">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style="background-color: ${category?.color || '#94a3b8'}">
                <i class="fa-solid ${category?.icon || 'fa-tag'} text-xl"></i>
            </div>
            <div class="flex-1 truncate">
                <p class="font-black text-slate-800 text-lg leading-tight truncate">${tx.label}</p>
                <p class="text-[11px] font-bold ${txInfo.ui.color} uppercase tracking-wider">${formattedAmount} • ${txInfo.src.name} → ${txInfo.dst.name}</p>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Animation
    setTimeout(() => {
        content.style.transform = 'translateY(0)';
    }, 10);

    // Setup action button listeners (once)
    const setupAction = (btnId, actionFn) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = () => {
                closeMobileActions();
                actionFn(currentMobileActionId);
            };
        }
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
