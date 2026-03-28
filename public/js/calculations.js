import { state } from './state.js';
import { getMonthKey } from './utils.js';

/**
 * Calculates account balances for a given date.
 * This optimized function starts with the latest `initialBalance` for each account
 * and only processes transactions that occurred after the account's `initialBalanceDate`.
 * This avoids re-calculating historical data for months that have been closed.
 * @param {Date} date The date to calculate balances for.
 * @returns {Object.<string, number>} A map of account IDs to their calculated balance.
 */
export const calculateBalances = (date) => {
    const balances = {};
    const accountInitialDates = {};
    state.accounts.forEach(a => {
        balances[a.id] = a.initialBalance || 0;
        accountInitialDates[a.id] = a.initialBalanceDate || '1970-01-01';
    });

    // Find the earliest date to know which month to start processing from.
    const earliestInitialDateStr = Object.values(accountInitialDates).reduce((earliest, current) => current < earliest ? current : earliest, '9999-12-31');
    const startDate = new Date(earliestInitialDateStr === '9999-12-31' ? '1970-01-01' : earliestInitialDateStr);
    const startProcessingMonthKey = getMonthKey(startDate);
    const targetMonthKey = getMonthKey(date);

    Object.keys(state.records).sort().forEach(monthKey => {
        // Only process months from our starting checkpoint up to the target date.
        if (monthKey >= startProcessingMonthKey && monthKey <= targetMonthKey && state.records[monthKey]) {
            state.records[monthKey].items.forEach(item => {
                // Subtract from source account if applicable, only if tx date is after the account's balance date
                if (item.source && accountInitialDates[item.source] && item.date > accountInitialDates[item.source]) {
                    balances[item.source] -= item.amount;
                }
                
                // Add to destination account if applicable, only if tx date is after the account's balance date
                if (item.destination && accountInitialDates[item.destination] && item.date > accountInitialDates[item.destination]) {
                    balances[item.destination] += item.amount;
                }
            });
        }
    });
    return balances;
};

/**
 * Calculates the total income for a specific month.
 * @param {Date} date The date for the month to calculate income.
 * @returns {number} The total income for the given month.
 */
export const calculateMonthlyIncome = (date) => {
    const monthKey = getMonthKey(date);
    const monthData = state.records[monthKey] || { items: [] };

    return monthData.items
        .filter(tx => tx.source === '') // As per spec 3.1, income has an empty source
        .reduce((sum, tx) => sum + tx.amount, 0);
};