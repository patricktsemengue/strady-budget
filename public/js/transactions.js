import { state } from './state.js';
import { 
    generateId, 
    getMonthKey, 
    getTxDisplayInfo, 
    generateDeterministicTransactionId, 
    generateDeterministicTemplateId, 
    formatCurrency,
    calculateIsInternalTransfer
} from './utils.js';
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
    const recurringToggleContainer = document.getElementById('recurring-toggle-container');
    const saveButton = form.querySelector('button[type="submit"]');

    // Helper to set read-only state
    const setReadOnly = (readonly) => {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.id === 'transaction-edit-id') return;
            input.disabled = readonly;
            if (readonly) {
                input.classList.add('bg-slate-50', 'cursor-not-allowed', 'opacity-70');
            } else {
                input.classList.remove('bg-slate-50', 'cursor-not-allowed', 'opacity-70');
            }
        });
        
        const cancelButton = document.getElementById('btn-cancel-transaction');
        if (cancelButton) {
            cancelButton.classList.toggle('hidden', readonly);
        }

        if (saveButton) {
            if (readonly) {
                // VIEW MODE: Neutral "Close" action
                saveButton.textContent = t('common.close') || 'Fermer';
                saveButton.setAttribute('data-i18n', 'common.close');
                saveButton.type = 'button';
                saveButton.onclick = closeTransactionModal;
                // Style as secondary/neutral
                saveButton.classList.remove('bg-slate-800', 'text-white');
                saveButton.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
            } else {
                // NEW MODE: Primary "Save" action
                saveButton.textContent = t('common.save') || 'Enregistrer';
                saveButton.setAttribute('data-i18n', 'common.save');
                saveButton.type = 'submit';
                saveButton.onclick = null;
                // Style as primary
                saveButton.classList.add('bg-slate-800', 'text-white');
                saveButton.classList.remove('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
            }
        }
    };

    if (id) { // VIEW MODE (formerly Edit)
        const modalTitle = document.getElementById('transaction-modal-title');
        if (modalTitle) modalTitle.textContent = t('transactions.modal_view_title') || 'Détails du flux';
        const editIdInput = document.getElementById('transaction-edit-id');
        if (editIdInput) editIdInput.value = id;

        setReadOnly(true);

        // Hide/Show recurring toggle based on transaction nature (single vs recurring series member)
        if (tx) {
            if (tx.Model) {
                if (recurringToggleContainer) recurringToggleContainer.classList.remove('hidden');
            } else {
                if (recurringToggleContainer) recurringToggleContainer.classList.add('hidden');
                if (recurringFields) recurringFields.classList.add('hidden');
            }
        }
    } else { // NEW MODE
        const modalTitle = document.getElementById('transaction-modal-title');
        if (modalTitle) modalTitle.textContent = t('transactions.modal_add_title');
        const editIdInput = document.getElementById('transaction-edit-id');
        if (editIdInput) editIdInput.value = '';

        setReadOnly(false);

        // NEW MODE: Always show and enable the toggle
        if (recurringToggleContainer) recurringToggleContainer.classList.remove('hidden');

        // Pre-fill for interactive setup
        if (state.onboarding?.active && state.onboarding?.type === 'interactive_setup' && state.onboarding?.currentStep === 2) {
            document.getElementById('transaction-label').value = 'Rent';
            document.getElementById('transaction-amount').value = '1200';
            document.getElementById('transaction-is-recurring').checked = true;
            if (recurringFields) recurringFields.classList.remove('hidden');
            
            // Auto-select the source account we just created
            const checkingAcc = state.accounts.find(a => a.name === 'Main Checking');
            if (checkingAcc) sourceSelect.value = checkingAcc.id;
            destSelect.value = ""; // External expense

            // Auto-select the category we just created
            const housingCat = state.categories.find(c => c.label === 'Housing');
            if (housingCat) categorySelect.value = housingCat.id;
        }
    }

    if (tx) { // Pre-fill for VIEW
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
    
    // Restriction: transaction cannot be before account creation date (TODO.md)
    const sourceAcc = state.accounts.find(a => a.id === source);
    const destAcc = state.accounts.find(a => a.id === destination);

    // Derive entityId from account ownership
    const isIncome = !source || source === 'external' || source === '';
    const entityId = isIncome ? (destAcc?.entityId || null) : (sourceAcc?.entityId || null);
    const isInternalTransfer = calculateIsInternalTransfer(source, destination);

    const isRecurringCheckbox = document.getElementById('transaction-is-recurring');
    const isRecurring = isRecurringCheckbox ? isRecurringCheckbox.checked : false;
    
    const periodicityEl = document.getElementById('transaction-periodicity');
    const periodicity = periodicityEl ? periodicityEl.value : 'M';
    
    const endDateEl = document.getElementById('transaction-end-date');
    const endDate = (endDateEl && endDateEl.value) ? endDateEl.value : null;

    // Validation from TODO.litcoffee
    if (!label || isNaN(amount) || !date || !Category) {
        showNotification(t('transactions.error_empty_fields'), 'error');
        return;
    }

    if ((!source || source === "" || source === "external") && (!destination || destination === "" || destination === "external")) {
        showNotification(t('transactions.error_both_external'), 'error');
        return;
    }

    if (source !== "" && source !== "external" && source === destination) {
        showNotification(t('transactions.error_same_source_dest') || 'Les comptes source et destination doivent être différents.', 'error');
        return;
    }

    if (sourceAcc && date < (sourceAcc.createDate || sourceAcc.initialBalanceDate)) {
        showNotification(`${t('transactions.error_before_creation')} (${sourceAcc.createDate || sourceAcc.initialBalanceDate}).`, 'error');
        return;
    }
    if (destAcc && date < (destAcc.createDate || destAcc.initialBalanceDate)) {
        showNotification(`${t('transactions.error_before_creation')} (${destAcc.createDate || destAcc.initialBalanceDate}).`, 'error');
        return;
    }

    try {
        if (!currentUserId) {
            showNotification(t('common.error_not_logged_in'), 'error');
            return;
        }

        const onFocusMonthKey = getMonthKey(state.viewDate);

        if (id) {
            // UPDATE CASE
            const tx = state.records[onFocusMonthKey]?.items.find(t => t.id === id);
            
            if (tx && tx.Model) {
                if (confirm(t('confirm.edit_recurring'))) {
                    // RECURRING UPDATE: delete-old and create-new
                    const newTemplateValues = { 
                        date, label, amount, source, destination, 
                        category: Category, Category: Category,
                        recurring: true, endDate, periodicity, entityId,
                        isInternalTransfer,
                        counterPartTxId: tx?.counterPartTxId || null
                    };
                    await updateRecurringSeriesInFirestore(currentUserId, tx.Model, newTemplateValues);
                    showNotification(t('transactions.success_recurring_updated'));
                } else {
                    return; // User cancelled
                }
            } else {
                if (confirm(t('confirm.edit_tx'))) {
                    // SINGLE UPDATE: delete-old and create-new
                    const newTxData = { 
                        label, amount, date, 
                        category: Category, Category: Category, 
                        source, destination, Model: null, entityId,
                        counterPartTxId: tx?.counterPartTxId || null,
                        isInternalTransfer
                    };
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
                    date, label, amount, source, destination, 
                    category: Category, Category: Category,
                    recurring: true, endDate, periodicity, entityId,
                    isInternalTransfer,
                    counterPartTxId: null // Transaction modal doesn't support cross-entity splits yet
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
                const newTxData = { 
                    label, amount, date, 
                    category: Category, Category: Category, 
                    source, destination, Model: null, entityId,
                    isInternalTransfer,
                    counterPartTxId: null
                };
                const newId = generateDeterministicTransactionId(newTxData);

                // Check if transaction already exists
                const allItems = Object.values(state.records).flatMap(r => r.items);
                const existingTx = allItems.find(t => t.id === newId);
                
                if (existingTx) {
                    showNotification(t('transactions.error_duplicate_tx'), 'error');
                    return;
                }

                await addTransactionToFirestore(currentUserId, {
                    id: newId, ...newTxData
                });
                showNotification(t('transactions.success_tx_created'));
                if (window.app.onTourAction) window.app.onTourAction('transaction_created');
            }
        }
        closeTransactionModal();
    } catch (err) {
        console.error('Save failed:', err);
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
        const hasCounterPart = !!tx.counterPartTxId;
        const confirmMsg = hasCounterPart 
            ? "Cette transaction a une contrepartie (virement entre entités). Les deux seront supprimées. Confirmer ?"
            : t('confirm.delete_tx');

        if (confirm(confirmMsg)) {
            try {
                await deleteTransactionFromFirestore(currentUserId, id);
                if (hasCounterPart) {
                    await deleteTransactionFromFirestore(currentUserId, tx.counterPartTxId);
                }
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
    const catId = tx.category || tx.Category;
    const category = state.categories.find(c => c.id === catId);
    const amount = tx.amount !== undefined ? tx.amount : tx.Amount;
    const formattedAmount = formatCurrency(amount);
    const label = tx.label || tx.Label;

    title.innerHTML = `
        <div class="flex items-center gap-3 text-left">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style="background-color: ${category?.color || '#94a3b8'}">
                <i class="fa-solid ${category?.icon || 'fa-tag'} text-lg"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-black text-slate-800 text-base leading-tight truncate">${label}</p>
                <p class="text-[10px] font-bold ${txInfo.ui.color} uppercase tracking-wider">${formattedAmount} • ${txInfo.src.name} → ${txInfo.dst.name}</p>
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
            btn.onclick = (e) => {
                e.stopPropagation();
                closeMobileActions();
                actionFn(currentMobileActionId);
            };
        }
    };

    setupAction('mobile-action-edit', editTransaction);
    const editBtn = document.getElementById('mobile-action-edit');
    if (editBtn) {
        const span = editBtn.querySelector('span');
        if (span) span.textContent = t('common.view_transaction') || 'Voir la transaction';
        const iconDiv = editBtn.querySelector('.bg-blue-50');
        if (iconDiv) {
            iconDiv.classList.remove('bg-blue-50', 'text-blue-600');
            iconDiv.classList.add('bg-indigo-50', 'text-indigo-600');
            iconDiv.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
    }
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
