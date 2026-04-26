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
    records: {},
    recurringTemplates: [],
    categories: [],
    assets: [],
    assetValues: [],
    liabilities: [],
    liabilityValues: [],
    months: {}, // Stores month statuses
    accountBalances: {}, // Stores pre-calculated balances: { "accountId_YYYY-MM-DD": balance }
    onboarding: {
        active: false,
        completed: false,
        currentStep: 0,
        type: null // 'starter' or 'scratch'
    },
    emergencyFundMultiplier: 3,
    monthSelectorConfig: {
        startDate: `${currentYear}-01-01`,
        endDate: getFunctionalBoundaryDate(),
        step: 'month'
    }
};

export const updateState = (newState) => {
    state = { ...state, ...newState };
};

export const rebuildRecords = (transactions, monthsStatuses) => {
    const newRecords = {};
    const viewMonthKey = getMonthKey(state.viewDate);
    const nextMonthDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
    const nextMonthKey = getMonthKey(nextMonthDate);

    // Filter and aggregate transactions
    transactions.forEach(tx => {
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

        // Calculate totals for all months
        // Note: getTxDisplayInfo is in utils.js, but since we don't want to import circular dependencies, 
        // we'll use a simplified check here or just assume it's done during render if needed.
        // For pruning, the main goal is to only keep 'items' for relevant months.
        
        const isIncome = !tx.source || tx.source === 'external';
        const isExpense = !tx.destination || tx.destination === 'external';

        if (isIncome) newRecords[monthKey].totals.income += tx.amount;
        if (isExpense) newRecords[monthKey].totals.expense += tx.amount;

        // Pruning logic: Only keep full transaction objects for Current and Next month
        if (monthKey === viewMonthKey || monthKey === nextMonthKey) {
            newRecords[monthKey].items.push(tx);
        }
    });

    // Ensure all explicit month statuses are in records
    Object.keys(monthsStatuses).forEach(monthKey => {
        if (!newRecords[monthKey]) {
            newRecords[monthKey] = { status: monthsStatuses[monthKey].status, items: [], totals: { income: 0, expense: 0 } };
        }
    });

    state.records = newRecords;
};
