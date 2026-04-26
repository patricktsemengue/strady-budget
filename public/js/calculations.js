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
    const selectedYear = targetDate.getFullYear();
    const selectedMonth = targetDate.getMonth() + 1;
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    
    state.accounts.forEach(acc => {
        // Find all balances for this account in the selected month
        const monthBalances = Object.keys(state.accountBalances)
            .filter(key => key.startsWith(`${acc.id}_${monthPrefix}`))
            .map(key => ({ date: key.split('_')[1], balance: state.accountBalances[key] }));

        if (monthBalances.length > 0) {
            // Pick the last one by date ascending (as per TODO.md)
            monthBalances.sort((a, b) => a.date.localeCompare(b.date));
            balances[acc.id] = monthBalances[monthBalances.length - 1].balance;
        } else {
            // Fallback: Find the latest balance BEFORE this month
            const priorBalances = Object.keys(state.accountBalances)
                .filter(key => key.startsWith(`${acc.id}_`) && key.split('_')[1] < monthPrefix)
                .map(key => ({ date: key.split('_')[1], balance: state.accountBalances[key] }));

            if (priorBalances.length > 0) {
                priorBalances.sort((a, b) => a.date.localeCompare(b.date));
                balances[acc.id] = priorBalances[priorBalances.length - 1].balance;
            } else {
                // Final fallback: find the absolute earliest record for this account
                const allAccountBalances = Object.keys(state.accountBalances)
                    .filter(key => key.startsWith(`${acc.id}_`))
                    .map(key => ({ date: key.split('_')[1], balance: state.accountBalances[key] }));
                
                if (allAccountBalances.length > 0) {
                    allAccountBalances.sort((a, b) => a.date.localeCompare(b.date));
                    balances[acc.id] = allAccountBalances[0].balance;
                } else {
                    balances[acc.id] = 0;
                }
            }
        }
    });

    return balances;
};

export const calculateActualBurnRate = (date) => {
    let totalExpense = 0;
    let monthsCount = 0;

    // Check last 3 months
    for (let i = 0; i < 3; i++) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
        const monthKey = getMonthKey(d);
        const monthData = state.records[monthKey];
        
        if (monthData && monthData.items.length > 0) {
            const monthExpense = monthData.items
                .filter(item => getTxDisplayInfo(item.source, item.destination).isExpense)
                .reduce((sum, item) => sum + item.amount, 0);
            
            totalExpense += monthExpense;
            monthsCount++;
        }
    }

    // Fallback if no data in last 3 months: use current month's projected expense from templates
    if (monthsCount === 0) {
        const currentMonthKey = getMonthKey(date);
        const currentMonthExpense = (state.records[currentMonthKey]?.items || [])
            .filter(item => getTxDisplayInfo(item.source, item.destination).isExpense)
            .reduce((sum, item) => sum + item.amount, 0);
        return currentMonthExpense;
    }

    return totalExpense / monthsCount;
};
