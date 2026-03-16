export let currentUserId = null;

export const setStorageUser = (userId) => {
    currentUserId = userId;
};

const getUIStorageKey = (userId) => {
    const id = userId || currentUserId;
    return id ? `stradyBudgetUI_${id}` : 'stradyBudgetUI';
};

export const saveUIState = (viewDate, currentView) => {
    try {
        localStorage.setItem(getUIStorageKey(), JSON.stringify({ viewDate, currentView }));
    } catch (e) { console.error('Save failed', e); }
};

export const loadUIState = () => {
    const saved = localStorage.getItem(getUIStorageKey());
    return saved ? JSON.parse(saved) : null;
};
