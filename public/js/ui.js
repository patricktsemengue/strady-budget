import { state, updateState } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderSettings } from './settings.js';

export const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notif = document.createElement('div');
    const isSuccess = type === 'success';
    const isError = type === 'error';
    const isInfo = type === 'info';

    let bgColor = 'bg-blue-50';
    let borderColor = 'border-blue-400';
    let textColor = 'text-blue-800';
    let icon = 'fa-circle-info';

    if (isSuccess) {
        bgColor = 'bg-green-50';
        borderColor = 'border-green-400';
        textColor = 'text-green-800';
        icon = 'fa-circle-check';
    } else if (isError) {
        bgColor = 'bg-red-50';
        borderColor = 'border-red-400';
        textColor = 'text-red-800';
        icon = 'fa-circle-exclamation';
    }

    notif.className = `flex items-center p-4 rounded-lg shadow-lg border-l-4 ${bgColor} ${borderColor} ${textColor} pointer-events-auto transition-all duration-500 opacity-0 transform translate-x-8`;
    notif.style.minWidth = '300px';
    
    notif.innerHTML = `
        <i class="fa-solid ${icon} mr-3 text-lg"></i>
        <div class="flex-1 font-medium">${message}</div>
        <button class="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(notif);

    // Animate in
    setTimeout(() => {
        notif.classList.remove('opacity-0', 'translate-x-8');
    }, 10);

    const closeNotif = () => {
        notif.classList.add('opacity-0', 'translate-x-8');
        setTimeout(() => notif.remove(), 500);
    };

    notif.querySelector('button').addEventListener('click', closeNotif);

    setTimeout(closeNotif, 5000);
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
