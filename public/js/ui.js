import { updateState } from './state.js';

export const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notif = document.createElement('div');
    const isSuccess = type === 'success';
    const isError = type === 'error';

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
        indicator.classList.remove('hidden');
        setTimeout(() => {
            indicator.classList.add('opacity-0');
        }, 2000);
        setTimeout(() => {
            indicator.classList.add('hidden');
            indicator.classList.remove('opacity-0');
        }, 2500);
    } else {
        indicator.classList.add('hidden');
    }
};

export const setLoadingState = (isLoading, title = 'Chargement...', subtitle = 'Veuillez patienter un instant') => {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    
    if (isLoading) {
        const titleEl = document.getElementById('loading-overlay-title');
        const subtitleEl = document.getElementById('loading-overlay-subtitle');
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = subtitle;
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
};

export const setView = (view, isInitial = false) => {
    window.location.hash = view;
};

