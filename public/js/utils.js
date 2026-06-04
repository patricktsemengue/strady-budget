import { state } from './state.js';

/**
 * Formats a numeric amount into the master application currency.
 * @param {number} amount - The numeric value.
 */
export const formatCurrency = (amount) => {
    const currencyCode = state.displayCurrency || 'EUR';
    return new Intl.NumberFormat(navigator.language || 'fr-BE', { 
        style: 'currency', 
        currency: currencyCode,
    }).format(amount);
};

/**
 * Formats a numeric amount into a specific currency code.
 */
export const formatSpecificCurrency = (amount, currencyCode) => {
    try {
        return new Intl.NumberFormat(navigator.language || 'fr-BE', { 
            style: 'currency', 
            currency: currencyCode || 'EUR',
        }).format(amount);
    } catch (err) {
        return `${amount.toFixed(2)} ${currencyCode}`;
    }
};

/**
 * Converts an amount from a source currency to the application's master currency.
 */
export const convertToAppCurrency = (amount, sourceCurrency) => {
    if (!sourceCurrency || sourceCurrency === state.displayCurrency) return amount;
    const rate = state.exchangeRates[sourceCurrency] || 1.0;
    return amount * rate;
};

export const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    // Use the UTC parts to avoid local timezone shifts
    const d = new Date(dateStr + 'T00:00:00Z');
    return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
};

export const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const getMonthFromDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.substring(0, 7);
};

/**
 * Calculates the 36-month boundary date from a given start date.
 * Capped at 36 months as per application mandates.
 */
export const get36MonthBoundary = (startDateStr) => {
    if (!startDateStr) return '';
    const date = new Date(startDateStr + 'T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + 36);
    return date.toISOString().split('T')[0];
};

export const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const generateDeterministicUUID = async (label) => {
    if (!label) return generateId();
    
    // Safety check for non-HTTPS environments where crypto.subtle is undefined
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        console.warn('[Utils] crypto.subtle not available. Falling back to random ID.');
        return generateId();
    }

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

export const debounce = (fn, ms) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
};

export const calculateIsInternalTransfer = (source, destination) => {
    const isSrcExt = !source || source === 'external' || source === '';
    const isDstExt = !destination || destination === 'external' || destination === '';
    return !isSrcExt && !isDstExt;
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

/**
 * Generates a small SVG Sparkline for a category's 6-month trend.
 */
export const generateSparklineSVG = (data, colorName = 'slate') => {
    const colorMap = {
        indigo: '#6366f1',
        rose: '#f43f5e',
        emerald: '#10b981',
        amber: '#f59e0b',
        slate: '#64748b',
        blue: '#3b82f6',
        orange: '#f97316',
        teal: '#14b8a6',
        cyan: '#06b6d4',
        pink: '#ec4899',
        purple: '#8b5cf6',
        violet: '#7c3aed',
        fuchsia: '#d946ef',
        lime: '#84cc16',
        yellow: '#eab308',
        sky: '#0ea5e9'
    };
    const colorHex = colorMap[colorName] || colorMap.slate;

    if (!data || data.length === 0) return '';
    
    const width = 60;
    const height = 20;
    const padding = 2;
    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, 0);
    const range = maxVal - minVal;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - ((val - minVal) / range) * (height - 2 * padding) - padding;
        return `${x},${y}`;
    }).join(' ');

    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible" style="display: inline-block; vertical-align: middle;">
            <polyline
                fill="none"
                stroke="${colorHex}"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                points="${points}"
                class="opacity-40"
            />
        </svg>
    `;
};
