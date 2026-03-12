import { state } from './state.js';

let currentUserId = null;

export const setStorageUser = (userId) => {
    currentUserId = userId;
};

const getStorageKey = (userId) => {
    const id = userId || currentUserId;
    return id ? `stradyBudgetState_${id}` : 'stradyBudgetState';
};

export const saveState = (userId = null) => {
    try {
        localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
    } catch (e) { console.error('Save failed', e); }
};

export const loadState = (userId = null) => {
    const saved = localStorage.getItem(getStorageKey(userId));
    return saved ? JSON.parse(saved) : null;
};
