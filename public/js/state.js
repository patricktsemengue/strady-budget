import { getMonthKey } from './utils.js';

export const defaultCategories = [
    { id: 'Revenu', label: 'Revenu', icon: 'fa-money-bill-wave', color: '#10b981' },
    { id: 'Logement', label: 'Logement', icon: 'fa-house', color: '#3b82f6' },
    { id: 'Alimentation', label: 'Alimentation', icon: 'fa-utensils', color: '#f59e0b' },
    { id: 'Transport', label: 'Transport / Auto', icon: 'fa-car', color: '#ef4444' },
    { id: 'Loisirs', label: 'Loisirs / Abonnements', icon: 'fa-gamepad', color: '#8b5cf6' },
    { id: 'Sante', label: 'Santé', icon: 'fa-heart-pulse', color: '#ec4899' },
    { id: 'Assurance', label: 'Assurance', icon: 'fa-shield-halved', color: '#64748b' },
    { id: 'Epargne', label: 'Épargne', icon: 'fa-piggy-bank', color: '#10b981' },
    { id: 'Provisions', label: 'Provisions', icon: 'fa-box-archive', color: '#f97316' },
    { id: 'Autre', label: 'Autre', icon: 'fa-tag', color: '#94a3b8' }
];

export let state = {
    currentView: 'dashboard',
    viewDate: new Date(),
    accounts: [],
    records: {},
    recurring: [],
    categories: [],
    months: {} // Stores month statuses
};

export const updateState = (newState) => {
    state = { ...state, ...newState };
};

export const rebuildRecords = (transactions, monthsStatuses) => {
    const newRecords = {};
    
    // Group transactions by month
    transactions.forEach(tx => {
        if (!tx.date) return;
        const monthKey = getMonthKey(new Date(tx.date));
        if (!newRecords[monthKey]) {
            newRecords[monthKey] = { status: monthsStatuses[monthKey]?.status || 'open', items: [] };
        }
        newRecords[monthKey].items.push(tx);
    });

    // Ensure all explicit month statuses are in records, even if empty
    Object.keys(monthsStatuses).forEach(monthKey => {
        if (!newRecords[monthKey]) {
            newRecords[monthKey] = { status: monthsStatuses[monthKey].status, items: [] };
        }
    });

    state.records = newRecords;
};
