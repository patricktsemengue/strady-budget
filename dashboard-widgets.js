import { state } from './state.js';
import { getMonthKey } from './utils.js';

/**
 * Calculates the current balance for all accounts.
 * This is more efficient than calculating one by one, as it iterates through transactions only once.
 * @returns {Object.<string, number>} A map of account IDs to their calculated balance.
 */
const calculateAllAccountBalances = () => {
    const balances = new Map();

    // 1. Initialize with initial balances from each account
    for (const account of state.accounts) {
        balances.set(account.id, {
            balance: account.initialBalance,
            initialDate: account.initialBalanceDate
        });
    }

    // 2. Process all transactions chronologically
    const allTransactions = state.transactions || [];
    const sortedTransactions = [...allTransactions].sort((a, b) => a.date.localeCompare(b.date));

    for (const tx of sortedTransactions) {
        // Subtract from source account if applicable
        const sourceInfo = balances.get(tx.source);
        if (sourceInfo && tx.date >= sourceInfo.initialDate) {
            sourceInfo.balance -= tx.amount;
        }

        // Add to destination account if applicable
        const destInfo = balances.get(tx.destination);
        if (destInfo && tx.date >= destInfo.initialDate) {
            destInfo.balance += tx.amount;
        }
    }

    const finalBalances = {};
    for (const [id, data] of balances.entries()) {
        finalBalances[id] = data.balance;
    }
    return finalBalances;
};

/**
 * Renders the Emergency Fund widget on the dashboard.
 * It calculates the total from savings accounts and updates the DOM.
 */
export const renderEmergencyFund = () => {
    const cardEl = document.getElementById('emergency-fund-card');
    const amountEl = document.getElementById('emergency-fund-amount');
    const sourcesEl = document.getElementById('emergency-fund-sources');

    if (!cardEl || !amountEl || !sourcesEl) return;

    const savingsAccounts = state.accounts.filter(acc => acc.isSavings);
    if (savingsAccounts.length === 0) {
        cardEl.classList.add('hidden'); // Hide card if no savings accounts
        return;
    }
    
    cardEl.classList.remove('hidden');

    const allBalances = calculateAllAccountBalances();
    let totalEmergencyFund = 0;
    const sourceNames = savingsAccounts.map(acc => {
        totalEmergencyFund += allBalances[acc.id] || 0;
        return acc.name;
    });

    const formatCurrency = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
    amountEl.textContent = formatCurrency(totalEmergencyFund);
    sourcesEl.textContent = `Comprend : ${sourceNames.join(', ')}`;
};

/**
 * Renders the Monthly Income widget on the dashboard.
 * It calculates the total income for the currently viewed month.
 */
export const renderMonthlyIncome = () => {
    const cardEl = document.getElementById('monthly-income-card');
    const amountEl = document.getElementById('monthly-income-amount');

    if (!cardEl || !amountEl) return;

    const monthKey = getMonthKey(state.viewDate);
    
    const monthlyTransactions = (state.transactions || []).filter(tx => tx.date && tx.date.startsWith(monthKey));

    const totalIncome = monthlyTransactions
        .filter(tx => tx.source === '') // As per spec 3.1, income has an empty source
        .reduce((sum, tx) => sum + tx.amount, 0);

    const formatCurrency = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
    amountEl.textContent = formatCurrency(totalIncome);
};