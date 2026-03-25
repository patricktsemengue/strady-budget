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

export const saveDataToCache = (userId, data) => {
    if (!userId) return;
    try {
        const cachePayload = {
            timestamp: new Date().toISOString(),
            data: data
        };
        localStorage.setItem(`stradyData_${userId}`, JSON.stringify(cachePayload));
    } catch (e) {
        console.error('Failed to save data to cache', e);
    }
};

export const loadDataFromCache = (userId) => {
    if (!userId) return null;
    const cached = localStorage.getItem(`stradyData_${userId}`);
    if (!cached) return null;
    
    try {
        const payload = JSON.parse(cached);
        return payload.data;
    } catch (e) {
        console.error('Failed to load data from cache', e);
        return null;
    }
};
