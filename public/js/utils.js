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

export const generateDeterministicId = (obj) => {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36) + str.length.toString(36);
};

export const generateDeterministicTransactionId = (txData) => {
    const key = `${txData.date}|${txData.label}|${txData.amount}|${txData.source}|${txData.destination}`;
    return `tx_${btoa(unescape(encodeURIComponent(key)))}`;
};

export const generateDeterministicTemplateId = (tplData) => {
    const key = `${tplData.date}|${tplData.label}|${tplData.amount}|${tplData.source}|${tplData.destination}|${tplData.periodicity}|${tplData.category}`;
    return `rec_${btoa(unescape(encodeURIComponent(key)))}`;
};

export const getTxDisplayInfo = (source, destination) => {
    const isSrcExt = source === '' || source === 'external';
    const isDstExt = destination === '' || destination === 'external';
    const src = isSrcExt ? { name: 'Externe' } : state.accounts.find(a => a.id === source) || { name: 'Supprimé' };
    const dst = isDstExt ? { name: 'Externe' } : state.accounts.find(a => a.id === destination) || { name: 'Supprimé' };

    if (isSrcExt && !isDstExt) return { src, dst, isIncome: true, isExpense: false, ui: { icon: 'fa-arrow-down', color: 'text-green-500' } };
    if (!isSrcExt && isDstExt) return { src, dst, isIncome: false, isExpense: true, ui: { icon: 'fa-arrow-up', color: 'text-red-500' } };
    return { src, dst, isIncome: false, isExpense: false, ui: { icon: 'fa-exchange-alt', color: 'text-blue-500' } };
};
