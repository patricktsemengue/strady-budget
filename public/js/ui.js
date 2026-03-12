import { state, updateState } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderSettings } from './settings.js';

export const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
    notif.className = `p-4 mb-4 text-sm rounded-lg ${colorClass}`;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
};

export const setView = (view, isInitial = false) => {
    updateState({ currentView: view });
    if (!isInitial) {
        window.location.hash = view;
    }
    render();
};

export const setViewDate = (date) => {
    updateState({ viewDate: new Date(date) });
    render();
};

export const render = () => {
    document.querySelectorAll('nav button').forEach(button => {
        const viewName = button.id.split('-')[1];
        if (viewName === state.currentView) {
            button.classList.add('text-blue-600', 'border-blue-600');
        } else {
            button.classList.remove('text-blue-600', 'border-blue-600');
        }
    });

    const dashboardView = document.getElementById('view-dashboard');
    const settingsView = document.getElementById('view-settings');
    
    if(state.currentView === 'dashboard') {
        dashboardView.classList.remove('hidden');
        settingsView.classList.add('hidden');
        renderDashboard();
    } else if (state.currentView === 'settings') {
        dashboardView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        renderSettings();
    }
};
