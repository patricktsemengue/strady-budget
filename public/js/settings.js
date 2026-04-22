import { renderCategoriesList } from './categories.js';
import { renderAccountsList } from './accounts.js';
import { state, getFunctionalBoundaryDate } from './state.js';
import { updateSettingsInFirestore } from './firestore-service.js';
import { currentUserId } from './storage.js';
import { showNotification } from './ui.js';

export const renderSettings = () => {
    console.log("Rendering Strategic Settings View");
    renderMonthSelectorConfig();
    updateEFMultiplierUI();
};

export const renderMonthSelectorConfig = () => {
    const config = state.monthSelectorConfig;
    const startInput = document.getElementById('config-month-start');
    const endInput = document.getElementById('config-month-end');

    if (startInput) startInput.value = config.startDate;
    if (endInput) {
        endInput.value = config.endDate;
        endInput.max = getFunctionalBoundaryDate();
    }
};

export const setSettingPreset = (type) => {
    const startInput = document.getElementById('config-month-start');
    const endInput = document.getElementById('config-month-end');
    const now = new Date();
    const currentYear = now.getFullYear();

    switch (type) {
        case 'cfo':
            startInput.value = `${currentYear}-01-01`;
            endInput.value = getFunctionalBoundaryDate();
            break;
        case 'history':
            // Find earliest transaction date in state
            let earliest = `${currentYear}-01-01`;
            state.transactions.forEach(tx => {
                if (tx.date < earliest) earliest = tx.date;
            });
            startInput.value = earliest;
            endInput.value = getFunctionalBoundaryDate();
            break;
        case 'year':
            startInput.value = `${currentYear}-01-01`;
            endInput.value = `${currentYear}-12-31`;
            break;
    }
};

export const updateEFMultiplier = async (multiplier) => {
    try {
        await updateSettingsInFirestore(currentUserId, 'emergencyFund', { multiplier });
        showNotification(`Objectif fond de sécurité mis à jour : ${multiplier} mois.`);
        updateEFMultiplierUI();
    } catch (err) {
        console.error(err);
        showNotification('Erreur lors de la mise à jour de l\'objectif.', 'error');
    }
};

const updateEFMultiplierUI = () => {
    const multiplier = state.emergencyFundMultiplier || 3;
    [3, 6, 12].forEach(val => {
        const btn = document.getElementById(`btn-ef-${val}`);
        if (btn) {
            if (val === multiplier) {
                btn.className = 'flex-1 py-3 rounded-xl text-sm font-black bg-indigo-600 text-white shadow-md transition-all scale-105';
            } else {
                btn.className = 'flex-1 py-3 rounded-xl text-sm font-bold bg-white text-slate-400 hover:bg-slate-100 transition-all';
            }
        }
    });
};

export const handleSaveMonthSelectorConfig = async (e) => {
    e.preventDefault();
    const startDate = document.getElementById('config-month-start').value;
    const endDateInput = document.getElementById('config-month-end');
    const endDate = endDateInput.value;
    const functionalBoundary = getFunctionalBoundaryDate();

    if (new Date(startDate) > new Date(endDate)) {
        showNotification('La date de début doit être antérieure à la date de fin.', 'error');
        return;
    }

    if (endDate > functionalBoundary) {
        showNotification(`La date de fin ne peut pas dépasser la limite fonctionnelle (${functionalBoundary}).`, 'error');
        endDateInput.value = functionalBoundary;
        return;
    }

    try {
        await updateSettingsInFirestore(currentUserId, 'monthSelector', {
            startDate,
            endDate,
            step: 'month'
        });
        showNotification('Configuration du sélecteur enregistrée.');
    } catch (err) {
        console.error(err);
        showNotification('Erreur lors de l\'enregistrement de la configuration.', 'error');
    }
};
