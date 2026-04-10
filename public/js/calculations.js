import { getMonthKey, getTxDisplayInfo } from './utils.js';
import { state } from './state.js';

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
