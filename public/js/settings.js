import { renderCategoriesList } from './categories.js';
import { renderAccountsList } from './accounts.js';
import { state, getFunctionalBoundaryDate } from './state.js';
import { updateSettingsInFirestore } from './firestore-service.js';
import { currentUserId } from './storage.js';
import { showNotification } from './ui.js';

export const renderSettings = () => {
    console.log("Rendering Settings View");
    renderCategoriesList();
    renderAccountsList();
    renderMonthSelectorConfig();
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
