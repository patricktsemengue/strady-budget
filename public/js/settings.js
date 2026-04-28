import { renderCategoriesList } from './categories.js';
import { renderAccountsList } from './accounts.js';
import { state, getFunctionalBoundaryDate, updateState } from './state.js';
import { updateSettingsInFirestore } from './firestore-service.js';
import { currentUserId } from './storage.js';
import { showNotification } from './ui.js';
import { t } from './i18n.js';
import { router } from './app-router.js';

export const renderSettings = () => {
    console.log("Rendering Strategic Settings View");
    renderMonthSelectorConfig();
    updateEFMultiplierUI();
};

export const updateCurrencySettings = async (updates) => {
    try {
        // Update local state first
        updateState(updates);
        
        // Persist to Firestore
        const currencyData = {
            displayCurrency: state.displayCurrency,
            exchangeRates: state.exchangeRates || {}
        };
        
        await updateSettingsInFirestore(currentUserId, 'currency', currencyData);
        showNotification(t('settings.notifications.currency_updated'));
        router.render();
    } catch (err) {
        console.error(err);
        showNotification(t('common.error'), 'error');
    }
};

export const addExchangeRate = async (code) => {
    if (!code) return;
    const rates = { ...(state.exchangeRates || {}) };
    rates[code] = 1.0;
    await updateCurrencySettings({ exchangeRates: rates });
};

export const updateExchangeRate = async (code, value) => {
    const rates = { ...(state.exchangeRates || {}) };
    rates[code] = parseFloat(value) || 0;
    await updateCurrencySettings({ exchangeRates: rates });
};

export const deleteExchangeRate = async (code) => {
    if (!confirm(t('settings.currency.confirm_delete'))) return;
    const rates = { ...(state.exchangeRates || {}) };
    delete rates[code];
    await updateCurrencySettings({ exchangeRates: rates });
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
        showNotification(t('settings.notifications.ef_updated', { multiplier }));
        updateEFMultiplierUI();
    } catch (err) {
        console.error(err);
        showNotification(t('settings.notifications.ef_error'), 'error');
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
        showNotification(t('settings.notifications.horizon_invalid'), 'error');
        return;
    }

    if (endDate > functionalBoundary) {
        showNotification(t('settings.notifications.horizon_boundary', { boundary: functionalBoundary }), 'error');
        endDateInput.value = functionalBoundary;
        return;
    }

    try {
        await updateSettingsInFirestore(currentUserId, 'monthSelector', {
            startDate,
            endDate,
            step: 'month'
        });
        showNotification(t('settings.notifications.horizon_saved'));
    } catch (err) {
        console.error(err);
        showNotification(t('settings.notifications.horizon_error'), 'error');
    }
};
