import { renderCategoriesList } from './categories.js';
import { renderAccountsList } from './accounts.js';
import { state } from './state.js';
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
    const stepSelect = document.getElementById('config-month-step');

    if (startInput) startInput.value = config.startDate;
    if (endInput) endInput.value = config.endDate;
    if (stepSelect) stepSelect.value = config.step;
};

export const handleSaveMonthSelectorConfig = async (e) => {
    e.preventDefault();
    const startDate = document.getElementById('config-month-start').value;
    const endDate = document.getElementById('config-month-end').value;
    const step = document.getElementById('config-month-step').value;

    if (new Date(startDate) > new Date(endDate)) {
        showNotification('La date de début doit être antérieure à la date de fin.', 'error');
        return;
    }

    try {
        await updateSettingsInFirestore(currentUserId, 'monthSelector', {
            startDate,
            endDate,
            step
        });
        showNotification('Configuration du sélecteur enregistrée.');
    } catch (err) {
        console.error(err);
        showNotification('Erreur lors de l\'enregistrement de la configuration.', 'error');
    }
};
