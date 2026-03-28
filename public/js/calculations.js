import { state } from './state.js';
import { getMonthKey } from './utils.js';

/**
 * Counts how many times a recurring event occurs between two dates.
 * @param {Object} tpl - The recurring template
 * @param {Date} startDate - Start of the window
 * @param {Date} endDate - End of the window
 * @returns {number} Number of occurrences
 */
const countOccurrences = (tpl, startDate, endDate) => {
    if (new Date(tpl.date) > endDate) return 0;

    // Effective end date is the earlier of the template's end date or the target end date.
    let effectiveEnd = endDate;
    if (tpl.endDate && new Date(tpl.endDate) < effectiveEnd) {
        effectiveEnd = new Date(tpl.endDate);
    }

    if (startDate > effectiveEnd) return 0;

    let count = 0;
    let current = new Date(tpl.date + 'T00:00:00');
    const anchorDay = current.getDate();

    while (current <= effectiveEnd) {
        if (current >= startDate) {
            count++;
        }

        switch (tpl.periodicity) {
            case 'M':
                current = new Date(current.getFullYear(), current.getMonth() + 1, anchorDay);
                if (current.getDate() !== anchorDay && new Date(current.getFullYear(), current.getMonth(), 0).getDate() < anchorDay) {
                     current = new Date(current.getFullYear(), current.getMonth(), 0);
                }
                break;
            case 'Q':
                current = new Date(current.getFullYear(), current.getMonth() + 3, anchorDay);
                if (current.getDate() !== anchorDay && new Date(current.getFullYear(), current.getMonth(), 0).getDate() < anchorDay) {
                     current = new Date(current.getFullYear(), current.getMonth(), 0);
                }
                break;
            case 'Y':
                current = new Date(current.getFullYear() + 1, current.getMonth(), anchorDay);
                break;
            default:
                return count;
        }
    }
    return count;
};

/**
 * Calculates account balances for a given date, including forecasting for recurring transactions.
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

    // 1. Process all EXISTING transactions up to the target date.
    const earliestInitialDateStr = Object.values(accountInitialDates).reduce((earliest, current) => current < earliest ? current : earliest, '9999-12-31');
    const startProcessingMonthKey = getMonthKey(new Date(earliestInitialDateStr === '9999-12-31' ? '1970-01-01' : earliestInitialDateStr));
    const targetMonthKey = getMonthKey(date);

    Object.keys(state.records).sort().forEach(monthKey => {
        if (monthKey >= startProcessingMonthKey && monthKey <= targetMonthKey && state.records[monthKey]) {
            state.records[monthKey].items.forEach(item => {
                if (item.source && accountInitialDates[item.source] && item.date > accountInitialDates[item.source]) {
                    balances[item.source] -= item.amount;
                }
                if (item.destination && accountInitialDates[item.destination] && item.date > accountInitialDates[item.destination]) {
                    balances[item.destination] += item.amount;
                }
            });
        }
    });

    // 2. Arithmetic Series for FORECASTING:
    // For each recurring template, we check if it has occurrences BEYOND what is already in state.records.
    // Our batch generation covers 36 months from the template start date.
    state.recurringTemplates.forEach(tpl => {
        const tplStartDate = new Date(tpl.date + 'T00:00:00');
        // The 36-month boundary:
        const batchEndLimit = new Date(tplStartDate.getFullYear() + 3, tplStartDate.getMonth(), tplStartDate.getDate() - 1);

        if (date > batchEndLimit) {
            // Calculate occurrences between (batchEndLimit + 1 day) and target date.
            const forecastStart = new Date(batchEndLimit);
            forecastStart.setDate(forecastStart.getDate() + 1);

            const count = countOccurrences(tpl, forecastStart, date);
            if (count > 0) {
                const totalAmount = count * tpl.amount;
                if (tpl.source && accountInitialDates[tpl.source] && tpl.date > accountInitialDates[tpl.source]) {
                    balances[tpl.source] = (balances[tpl.source] || 0) - totalAmount;
                }
                if (tpl.destination && accountInitialDates[tpl.destination] && tpl.date > accountInitialDates[tpl.destination]) {
                    balances[tpl.destination] = (balances[tpl.destination] || 0) + totalAmount;
                }
            }
        }
    });

    return balances;
};

/**
 * Calculates the total income for a specific month, including forecasted recurring income.
 * @param {Date} date The date for the month to calculate income.
 * @returns {number} The total income for the given month.
 */
export const calculateMonthlyIncome = (date) => {
    const monthKey = getMonthKey(date);
    const monthData = state.records[monthKey] || { items: [] };

    let income = monthData.items
        .filter(tx => tx.source === '') 
        .reduce((sum, tx) => sum + tx.amount, 0);

    // Forecast check: if this month is beyond any batch-generated transactions for a template
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    state.recurringTemplates.forEach(tpl => {
        if (tpl.source === '') { // It's an income template
            const tplStartDate = new Date(tpl.date + 'T00:00:00');
            const batchEndLimit = new Date(tplStartDate.getFullYear() + 3, tplStartDate.getMonth(), tplStartDate.getDate() - 1);

            if (monthStart > batchEndLimit) {
                const count = countOccurrences(tpl, monthStart, monthEnd);
                income += count * tpl.amount;
            }
        }
    });

    return income;
    };

    /**
    * Calculates the total spending for a specific month, including forecasted recurring expenses.
    * @param {Date} date The date for the month to calculate spending.
    * @returns {number} The total spending for the given month.
    */
    export const calculateMonthlySpending = (date) => {
    const monthKey = getMonthKey(date);
    const monthData = state.records[monthKey] || { items: [] };

    let spending = monthData.items
        .filter(tx => tx.destination === '') // As per spec, spending has an empty destination
        .reduce((sum, tx) => sum + tx.amount, 0);

    // Forecast check: if this month is beyond any batch-generated transactions for a template
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    state.recurringTemplates.forEach(tpl => {
        if (tpl.destination === '') { // It's an expense template
            const tplStartDate = new Date(tpl.date + 'T00:00:00');
            const batchEndLimit = new Date(tplStartDate.getFullYear() + 3, tplStartDate.getMonth(), tplStartDate.getDate() - 1);

            if (monthStart > batchEndLimit) {
                const count = countOccurrences(tpl, monthStart, monthEnd);
                spending += count * tpl.amount;
            }
        }
    });

    return spending;
    };