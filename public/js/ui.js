import { state, updateState } from './state.js';
import { renderDashboard, renderTransactions } from './dashboard.js';
import { renderSettings } from './settings.js';
import { renderEmergencyFund, renderMonthlyIncome } from './dashboard-widgets.js';
import { currentUserId } from './storage.js';
import { getMonthKey } from './utils.js';

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

export const setDataStatusIndicator = (status) => {
    const indicator = document.getElementById('data-status-indicator');
    if (!indicator) return;

    if (status === 'cached') {
        indicator.textContent = 'Données en cache';
        indicator.className = 'fixed top-[68px] md:top-[100px] left-1/2 -translate-x-1/2 z-40 px-3 py-1 text-xs font-semibold rounded-full shadow-md transition-all duration-300 bg-amber-100 text-amber-800';
        indicator.classList.remove('hidden');
    } else if (status === 'live') {
        indicator.textContent = 'Données à jour';
        indicator.className = 'fixed top-[68px] md:top-[100px] left-1/2 -translate-x-1/2 z-40 px-3 py-1 text-xs font-semibold rounded-full shadow-md transition-all duration-300 bg-green-100 text-green-800';
        indicator.classList.remove('hidden'); // Ensure it's visible before fading
        // Fade out after a couple of seconds
        setTimeout(() => {
            indicator.classList.add('opacity-0');
        }, 2000);
        // Hide completely after fade out
        setTimeout(() => {
            indicator.classList.add('hidden');
            indicator.classList.remove('opacity-0'); // reset for next time
        }, 2500);
    } else {
        indicator.classList.add('hidden');
    }
};

export const setView = (view, isInitial = false) => {
    updateState({ currentView: view });
    if (!isInitial) {
        window.location.hash = view;
    }
    render();
};

export const setViewDate = async (date) => {
    const newDate = new Date(date);
    updateState({ viewDate: newDate });
    localStorage.setItem('viewDate', newDate.toISOString());
    render();
};

export const render = () => {
    const sharedMonthSelection = document.getElementById('shared-month-selection');
    const viewsWithMonthSelection = ['dashboard', 'transactions', 'accounts'];
    
    if (sharedMonthSelection) {
        if (viewsWithMonthSelection.includes(state.currentView)) {
            sharedMonthSelection.classList.remove('hidden');
        } else {
            sharedMonthSelection.classList.add('hidden');
        }
    }

    document.querySelectorAll('nav button').forEach(button => {
        const viewName = button.id.split('-')[1];
        if (viewName === state.currentView) {
            button.classList.add('text-blue-600', 'border-blue-600');
        } else {
            button.classList.remove('text-blue-600', 'border-blue-600');
        }
    });

    const views = {
        dashboard: document.getElementById('view-dashboard'),
        transactions: document.getElementById('view-transactions'),
        accounts: document.getElementById('view-accounts'),
        categories: document.getElementById('view-categories'),
        settings: document.getElementById('view-settings')
    };

    const mobileFab = document.getElementById('mobile-fab');
    
    // Hide all views first
    Object.values(views).forEach(view => {
        if (view) view.classList.add('hidden');
    });

    // Show current view and render its content
    if (views[state.currentView]) {
        views[state.currentView].classList.remove('hidden');
    }

    if (state.currentView === 'dashboard') {
        if (mobileFab) mobileFab.classList.remove('hidden');
        renderDashboard();
        renderEmergencyFund();
        renderMonthlyIncome();
    } else if (state.currentView === 'transactions') {
        if (mobileFab) mobileFab.classList.remove('hidden');
        import('./dashboard.js').then(m => m.renderTimeline());
        renderTransactions();
    } else if (state.currentView === 'accounts') {
        if (mobileFab) mobileFab.classList.add('hidden');
        import('./dashboard.js').then(m => m.renderTimeline());
        renderSettings(); // renderSettings handles both accounts and categories rendering in the current logic
    } else if (state.currentView === 'categories') {
        if (mobileFab) mobileFab.classList.add('hidden');
        renderSettings();
    } else if (state.currentView === 'settings') {
        if (mobileFab) mobileFab.classList.add('hidden');
        renderSettings();
    }
};
