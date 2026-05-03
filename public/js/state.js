import { getMonthKey } from './utils.js';

export const defaultCategories = [
    { id: '5780f07c-3f2a-4095-9e66-3359107922aa', label: 'Revenu', nature: 'REVENU', icon: 'fa-money-bill-wave', color: '#10b981' },
    { id: '66bb0680-e71d-4ac8-9ca4-6c99a0828eae', label: 'Logement', nature: 'FIXE', icon: 'fa-house', color: '#3b82f6' },
    { id: '0aa98af8-8252-4c00-97be-783ba2eae1e8', label: 'Alimentation', nature: 'QUOTIDIEN', icon: 'fa-utensils', color: '#f59e0b' },
    { id: '6694ea80-7500-4f66-a8da-20f1afdafc74', label: 'Transport', nature: 'QUOTIDIEN', icon: 'fa-car', color: '#ef4444' },
    { id: 'bf3bed38-06f5-4ef3-b1c8-591f84cf57ea', label: 'Loisirs', nature: 'LOISIR', icon: 'fa-gamepad', color: '#8b5cf6' },
    { id: '4fe47baa-a01a-4d88-8f54-9fe3ca7d92e0', label: 'Sante', nature: 'QUOTIDIEN', icon: 'fa-heart-pulse', color: '#ec4899' },
    { id: '9b2d53ab-ee43-4c91-8a12-6f5f79a30616', label: 'Assurance', nature: 'FIXE', icon: 'fa-shield-halved', color: '#64748b' },
    { id: 'b97b19e7-e79d-4ccb-b4f6-5d6cb6a093dc', label: 'Epargne', nature: 'EPARGNE', icon: 'fa-piggy-bank', color: '#10b981' },
    { id: '59216e61-6e82-441c-8a6f-6cd8707084e7', label: 'Provisions', nature: 'FIXE', icon: 'fa-box-archive', color: '#f97316' },
    { id: 'e996f291-499e-4419-8e47-d296e2d95898', label: 'Autre', nature: 'QUOTIDIEN', icon: 'fa-tag', color: '#94a3b8' }
];

const now = new Date();
const currentYear = now.getFullYear();

export const getFunctionalBoundaryDate = () => {
    const year = new Date().getFullYear();
    return `${year + 3}-12-31`;
};

export let state = {
    currentView: 'dashboard',
    viewDate: new Date(),
    accounts: [],
    entities: [],
    selectedEntityId: 'all',
    records: {},
    transactions: [],
    allTransactions: [],
    recurringTemplates: [],
    categories: [],
    assets: [],
    assetValues: [],
    liabilities: [],
    liabilityValues: [],
    months: {}, 
    accountBalances: {},
    onboarding: {
        active: false,
        completed: false,
        currentStep: 0,
        type: null
    },
    emergencyFundMultiplier: 3,
    displayCurrency: 'EUR',
    exchangeRates: {
        'USD': 1.0,
        'BTC': 60000.0
    },
    monthSelectorConfig: {
        startDate: `${currentYear}-01-01`,
        endDate: getFunctionalBoundaryDate(),
        step: 'month'
    },
    monthSelectorPosition: 'top'
};

export const updateState = (newState) => {
    state = { ...state, ...newState };
};

export const rebuildRecords = (transactions, monthsStatuses) => {
    const newRecords = {};
    const viewMonthKey = getMonthKey(state.viewDate);
    const nextMonthDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
    const nextMonthKey = getMonthKey(nextMonthDate);

    const filteredTransactions = (transactions || []).filter(tx => {
        if (state.selectedEntityId === 'all') return true;
        return tx.entityId === state.selectedEntityId;
    });

    filteredTransactions.forEach(tx => {
        if (!tx.date) return;
        const txDate = new Date(tx.date);
        const monthKey = getMonthKey(txDate);
        
        if (!newRecords[monthKey]) {
            newRecords[monthKey] = { 
                status: monthsStatuses[monthKey]?.status || 'open', 
                items: [],
                totals: { income: 0, expense: 0 }
            };
        }

        const isIncome = !tx.source || tx.source === 'external';
        const isExpense = !tx.destination || tx.destination === 'external';

        if (isIncome) newRecords[monthKey].totals.income += tx.amount;
        if (isExpense) newRecords[monthKey].totals.expense += tx.amount;

        if (monthKey === viewMonthKey || monthKey === nextMonthKey) {
            newRecords[monthKey].items.push(tx);
        }
    });

    Object.keys(monthsStatuses || {}).forEach(monthKey => {
        if (!newRecords[monthKey]) {
            newRecords[monthKey] = { status: monthsStatuses[monthKey].status, items: [], totals: { income: 0, expense: 0 } };
        }
    });

    state.records = newRecords;
};
