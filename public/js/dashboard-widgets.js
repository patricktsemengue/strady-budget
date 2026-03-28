import { state } from './state.js';
import { formatCurrency } from './utils.js';
import { calculateBalances, calculateMonthlyIncome } from './calculations.js';

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

    const allBalances = calculateBalances(new Date()); // Calculate current balance
    let totalEmergencyFund = 0;
    const sourceNames = savingsAccounts.map(acc => {
        totalEmergencyFund += allBalances[acc.id] || 0;
        return acc.name;
    });

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

    const totalIncome = calculateMonthlyIncome(state.viewDate);
    amountEl.textContent = formatCurrency(totalIncome);
};