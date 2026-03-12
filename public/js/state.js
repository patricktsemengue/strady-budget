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

export const mockAccounts = [
    { id: 'acc_main', name: 'Compte Courant Principal', initialBalance: 1200, initialBalanceDate: '2025-12-31', isSavings: false },
    { id: 'acc_sav', name: 'Livret Épargne', initialBalance: 3000, initialBalanceDate: '2025-12-31', isSavings: true }
];

export const mockRecurring = [
    { id: 'rec_loyer', label: 'Loyer', amount: 950, sourceId: 'acc_main', destinationId: 'external', startMonth: '2026-01', endMonth: '2026-12', category: 'Logement' }
];

export const mockRecords = {
    "2026-03": {
        status: 'open',
        items: [
            { id: '1', label: 'Salaire mensuel', amount: 2800, date: '2026-03-02', sourceId: 'external', destinationId: 'acc_main', category: 'Revenu' },
            { id: 'rec_loyer_inst', label: 'Loyer', amount: 950, date: '2026-03-01', sourceId: 'acc_main', destinationId: 'external', isRecurringInst: true, parentId: 'rec_loyer', category: 'Logement' },
        ]
    },
    "2026-04": {
        status: 'open',
        items: [
            { id: 'anticip_1', label: 'Assurance Auto Annuelle', amount: 450, date: '2026-04-30', sourceId: 'acc_main', destinationId: 'external', category: 'Assurance' }
        ]
    }
};

export let state = {
    currentView: 'dashboard',
    viewDate: new Date(),
    accounts: [],
    records: {},
    recurring: [],
    categories: [],
};

export const updateState = (newState) => {
    state = { ...state, ...newState };
};
