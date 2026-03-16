import { state } from './state.js';

export const formatCurrency = (amount) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);

export const formatDateStr = (dateStr) => dateStr ? new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' }).format(new Date(dateStr)) : '';

export const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const getTxDisplayInfo = (sourceId, destinationId) => {
    const isSrcExt = sourceId === 'external';
    const isDstExt = destinationId === 'external';
    const src = isSrcExt ? { name: 'Externe' } : state.accounts.find(a => a.id === sourceId) || { name: 'Supprimé' };
    const dst = isDstExt ? { name: 'Externe' } : state.accounts.find(a => a.id === destinationId) || { name: 'Supprimé' };

    if (isSrcExt && !isDstExt) return { src, dst, isIncome: true, isExpense: false, ui: { icon: 'fa-arrow-down', color: 'text-green-500' } };
    if (!isSrcExt && isDstExt) return { src, dst, isIncome: false, isExpense: true, ui: { icon: 'fa-arrow-up', color: 'text-red-500' } };
    return { src, dst, isIncome: false, isExpense: false, ui: { icon: 'fa-exchange-alt', color: 'text-blue-500' } };
};
