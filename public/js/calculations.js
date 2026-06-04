import { getMonthKey, getTxDisplayInfo } from './utils.js';
import { state } from './state.js';

const calculateMonthlyIncome = (date) => {
    const monthKey = getMonthKey(date);
    const monthItems = state.records[monthKey]?.items || [];
    
    return monthItems
        .filter(item => {
            const isIncome = !item.source || item.source === 'external';
            if (!isIncome) return false;
            // Rule: Ignore internal movements when viewing the entire household
            if (state.selectedEntityId === 'all' && item.isInternalTransfer) return false;
            return true;
        })
        .reduce((sum, item) => sum + item.amount, 0);
};

const calculateBalances = (targetDate) => {
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

const calculateActualBurnRate = (date = new Date()) => {
    let totalExpense = 0;
    let monthsCount = 0;
    const referenceDate = new Date();
    
    for (let i = 0; i < 3; i++) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
        const monthKey = getMonthKey(d);
        const monthData = state.records[monthKey];
        
        if (monthData && monthData.items.length > 0) {
            const items = state.selectedEntityId === 'all' 
                ? monthData.items.filter(it => !it.isInternalTransfer) 
                : monthData.items.filter(it => it.entityId === state.selectedEntityId);

            const monthExpense = items
                .filter(item => !item.destination || item.destination === 'external')
                .reduce((sum, item) => sum + item.amount, 0);
            
            if (monthExpense > 0) {
                totalExpense += monthExpense;
                monthsCount++;
            }
        }
    }

    if (monthsCount === 0) {
        const currentMonthKey = getMonthKey(date);
        const monthItems = state.records[currentMonthKey]?.items || [];
        const items = state.selectedEntityId === 'all' 
            ? monthItems.filter(it => !it.isInternalTransfer) 
            : monthItems.filter(it => it.entityId === state.selectedEntityId);

        return items
            .filter(item => !item.destination || item.destination === 'external')
            .reduce((sum, item) => sum + item.amount, 0);
    }

    return totalExpense / monthsCount;
};

const calculateAverageSavings = (date = new Date()) => {
    let totalSavings = 0;
    let monthsCount = 0;
    const referenceDate = new Date();

    for (let i = 0; i < 3; i++) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
        const monthKey = getMonthKey(d);
        const monthData = state.records[monthKey];
        
        if (monthData && monthData.items.length > 0) {
            const items = state.selectedEntityId === 'all' 
                ? monthData.items.filter(it => !it.isInternalTransfer) 
                : (monthData.items || []).filter(it => it.entityId === state.selectedEntityId);

            let mIn = 0, mOut = 0;
            items.forEach(item => {
                const isIncome = !item.source || item.source === 'external';
                const isExpense = !item.destination || item.destination === 'external';
                if (isIncome) mIn += item.amount;
                if (isExpense) mOut += item.amount;
            });

            totalSavings += (mIn - mOut);
            monthsCount++;
        }
    }

    if (monthsCount === 0) {
        const monthKey = getMonthKey(date);
        const items = state.records[monthKey]?.items || [];
        const filtered = state.selectedEntityId === 'all' 
            ? items.filter(it => !it.isInternalTransfer) 
            : items.filter(it => it.entityId === state.selectedEntityId);
        let mIn = 0, mOut = 0;
        filtered.forEach(item => {
            const isIncome = !item.source || item.source === 'external';
            const isExpense = !item.destination || item.destination === 'external';
            if (isIncome) mIn += item.amount;
            else if (isExpense) mOut += item.amount;
        });
        return mIn - mOut;
    }

    return totalSavings / monthsCount;
};

/**
 * Calculates the estimated years until Financial Independence.
 */
const calculateTimeToFreedom = (date) => {
    const monthlyExpenses = calculateActualBurnRate(date);
    const monthlySavings = calculateAverageSavings(date);
    const targetCapital = monthlyExpenses * 12 * 25;
    const currentCapital = state.accounts
        .filter(acc => {
            const isEntityMatch = state.selectedEntityId === 'all' || acc.entityId === state.selectedEntityId;
            const isWealthAccount = acc.isSaving || acc.isInvestmentAccount;
            return isEntityMatch && isWealthAccount;
        })
        .reduce((sum, acc) => {
            const balances = calculateBalances(date);
            return sum + (balances[acc.id] || 0);
        }, 0);

    if (currentCapital >= targetCapital) return { years: 0, targetCapital, currentCapital, monthlySavings };
    if (monthlySavings <= 0) return { years: 99, targetCapital, currentCapital, monthlySavings };

    const annualRate = 0.05;
    const r = annualRate / 12;

    try {
        const n = Math.log((monthlySavings + targetCapital * r) / (monthlySavings + currentCapital * r)) / Math.log(1 + r);
        const years = isNaN(n) ? 99 : Math.max(0, n / 12);
        return { years, targetCapital, currentCapital, monthlySavings };
    } catch (e) {
        return { years: 99, targetCapital, currentCapital, monthlySavings };
    }
};

export {
    calculateMonthlyIncome,
    calculateBalances,
    calculateActualBurnRate,
    calculateAverageSavings,
    calculateTimeToFreedom
};
