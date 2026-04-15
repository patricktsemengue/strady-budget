import { state } from './state.js';

export const formatCurrency = (amount) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(amount);

export const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    // Use the UTC parts to avoid local timezone shifts
    const d = new Date(dateStr + 'T00:00:00Z');
    return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
};

export const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const generateDeterministicUUID = async (label) => {
    if (!label) return generateId();
    const encoder = new TextEncoder();
    const data = encoder.encode(label.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    // Use first 16 bytes for UUID (32 hex characters)
    const hex = hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        '4' + hex.substring(13, 16),
        ((parseInt(hex.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hex.substring(18, 20),
        hex.substring(20, 32)
    ].join('-');
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
