import { getMonthKey, getTxDisplayInfo } from './utils.js';
import { state } from './state.js';

/**
 * Calculates all occurrence dates for a recurring template based on its periodicity (UTC).
 */
const calculateAllOccurrencesUTC = (template, endDateLimit) => {
    const occurrences = [];
    let current = new Date(template.date + 'T00:00:00Z');
    const endDate = new Date(endDateLimit.toISOString());
    const anchorDay = current.getUTCDate();

    while (current <= endDate) {
        occurrences.push(new Date(current.toISOString()));

        switch (template.periodicity) {
            case 'M':
                current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, anchorDay));
                if (current.getUTCDate() !== anchorDay) {
                    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0));
                }
                break;
            case 'Q':
                current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 3, anchorDay));
                if (current.getUTCDate() !== anchorDay) {
                    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0));
                }
                break;
            case 'Y':
                current = new Date(Date.UTC(current.getUTCFullYear() + 1, current.getUTCMonth(), anchorDay));
                break;
            default:
                return occurrences; 
        }
    }
    return occurrences;
};

export const calculateMonthlyIncome = (date) => {
    const monthKey = getMonthKey(date);
    const monthItems = state.records[monthKey]?.items || [];
    
    // Sum existing transactions (both single and generated recurring)
    return monthItems
        .filter(item => getTxDisplayInfo(item.source, item.destination).isIncome)
        .reduce((sum, item) => sum + item.amount, 0);
};

export const calculateBalances = (targetDate) => {
    const balances = {};
    
    // Initialize with account initial balances
    state.accounts.forEach(acc => {
        balances[acc.id] = acc.initialBalance || 0;
    });

    const targetDateUTC = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59));

    // Process all existing transactions up to targetDate
    Object.values(state.records).forEach(month => {
        month.items.forEach(tx => {
            const txDate = new Date(tx.date + 'T00:00:00Z');
            if (txDate <= targetDateUTC) {
                if (tx.source && balances[tx.source] !== undefined) {
                    balances[tx.source] -= tx.amount;
                }
                if (tx.destination && balances[tx.destination] !== undefined) {
                    balances[tx.destination] += tx.amount;
                }
            }
        });
    });

    return balances;
};
