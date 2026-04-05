import { state, updateState, defaultCategories, rebuildRecords } from './state.js';
import { setStorageUser, loadDataFromCache } from './storage.js';
import { setView, setViewDate, render, showNotification, setDataStatusIndicator } from './ui.js';
import { router } from './app-router.js';

// Modules
import dashboardModule from './modules/dashboard-module.js';
import transactionsModule from './modules/transactions-module.js';
import accountsModule from './modules/accounts-module.js';
import categoriesModule from './modules/categories-module.js';
import settingsModule from './modules/settings-module.js';

import { 
    handleAddCategory, 
    closeCategoryDrawer, 
    handleUpdateCategory, 
    closeAddCategoryDrawer,
    closeCategoryActions
} from './categories.js';
import { 
    handleAddAccount, 
    closeAccountDrawer, 
    handleUpdateAccount, 
    closeAddAccountDrawer,
    closeAccountActions,
    renderAccountsList
} from './accounts.js';
import { 
    closeTransactionModal, 
    handleSaveTransaction,
    editTransaction,
    deleteTransaction,
    openTransactionModal,
    openMobileActions,
    closeMobileActions
} from './transactions.js';

import { logout, onUserChanged } from './auth.js';
import { subscribeToAppData } from './firestore-service.js';

const init = () => {
    // Initialize Router
    router.setNavContainers('nav-desktop', 'nav-mobile');
    router.register(dashboardModule);
    router.register(transactionsModule);
    router.register(accountsModule);
    router.register(categoriesModule);
    router.register(settingsModule);

    setupEventListeners();

    // Firebase Auth listener
    onUserChanged(async (user) => {
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');
        const userPhoto = document.getElementById('user-photo');
        
        const userInfoMobile = document.getElementById('user-info-mobile');
        const userNameMobile = document.getElementById('user-name-mobile');
        const userEmailMobile = document.getElementById('user-email-mobile');
        const userPhotoMobile = document.getElementById('user-photo-mobile');

        const mainContent = document.querySelector('main');

        if (user) {
            setStorageUser(user.uid);
            // User is signed in
            if (userInfo) userInfo.classList.remove('hidden');
            if (userName) userName.textContent = user.displayName;
            if (userPhoto) userPhoto.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

            if (userInfoMobile) userInfoMobile.classList.remove('hidden');
            if (userNameMobile) userNameMobile.textContent = user.displayName;
            if (userEmailMobile) userEmailMobile.textContent = user.email;
            if (userPhotoMobile) userPhotoMobile.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

            // 1. Load from cache first for instant UI
            const cachedData = loadDataFromCache(user.uid);
            if (cachedData) {
                setDataStatusIndicator('cached');
                updateState({
                    accounts: cachedData.accounts || [],
                    categories: cachedData.categories || defaultCategories,
                    recurringTemplates: cachedData.recurringTemplates || [],
                    months: cachedData.months || {}
                });
                rebuildRecords(cachedData.transactions || [], cachedData.months || {});
                render(); // Render immediately with cached data
            }

            // 2. Subscribe to Firestore for live data and updates
            let isFirstFirestoreUpdate = true;
            subscribeToAppData(user.uid, (newData) => {
                if (isFirstFirestoreUpdate) {
                    if (cachedData) { // Only show the "live" transition if we started from cache
                        setDataStatusIndicator('live');
                    }
                    isFirstFirestoreUpdate = false;
                }
                updateState({
                    accounts: newData.accounts || [],
                    transactions: newData.transactions || [],
                    categories: newData.categories || defaultCategories,
                    recurringTemplates: newData.recurringTemplates || [],
                    months: newData.months || {}
                });
                
                if (newData.categories && newData.categories.length === 0) {
                    updateState({ categories: defaultCategories });
                }

                rebuildRecords(newData.transactions || [], newData.months || {});
            router.render();
        });

        const initialView = window.location.hash.substring(1) || 'dashboard';
        router.setView(initialView);
        
        // Show content
        if (mainContent) mainContent.classList.remove('hidden');
    } else {
        // User is signed out, redirect to login page
        setStorageUser(null);
        if (mainContent) mainContent.classList.add('hidden');
        window.location.href = 'login.html';
    }
});

// Handle hash navigation
window.addEventListener('hashchange', () => {
    const view = window.location.hash.substring(1) || 'dashboard';
    router.setView(view);
});
};

const setupEventListeners = () => {

const handleLogout = async () => {
    if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
        try {
            await logout();
            showNotification("Vous avez été déconnecté");
        } catch (error) {
            showNotification("Erreur lors de la déconnexion", "error");
        }
    }
};

const addSafeListener = (selector, event, handler, isQuerySelector = false) => {
    const element = isQuerySelector ? document.querySelector(selector) : document.getElementById(selector);
    if (element) {
        element.addEventListener(event, handler);
    }
};

addSafeListener('btn-logout', 'click', handleLogout);
addSafeListener('btn-logout-mobile', 'click', handleLogout);
addSafeListener('.mobile-menu-button', 'click', () => document.querySelector('.mobile-menu').classList.toggle('hidden'), true);

addSafeListener('prev-month', 'click', () => { 
    const d = new Date(state.viewDate);
    const step = state.monthSelectorConfig.step;
    if (step === 'month') {
        d.setMonth(d.getMonth() - 1);
    } else {
        d.setMonth(d.getMonth() - 3);
    }
    const newDate = new Date(d);
    updateState({ viewDate: newDate });
    localStorage.setItem('viewDate', newDate.toISOString());
    router.render();
});
addSafeListener('next-month', 'click', () => { 
    const d = new Date(state.viewDate);
    const step = state.monthSelectorConfig.step;
    if (step === 'month') {
        d.setMonth(d.getMonth() + 1);
    } else {
        d.setMonth(d.getMonth() + 3);
    }
    const newDate = new Date(d);
    updateState({ viewDate: newDate });
    localStorage.setItem('viewDate', newDate.toISOString());
    router.render();
});

    // Forms and shared UI components
    addSafeListener('add-category-form', 'submit', handleAddCategory);
    addSafeListener('btn-close-add-cat-drawer', 'click', closeAddCategoryDrawer);
    addSafeListener('btn-cancel-add-cat', 'click', closeAddCategoryDrawer);
    
    addSafeListener('edit-category-form', 'submit', handleUpdateCategory);
    addSafeListener('btn-close-cat-drawer', 'click', closeCategoryDrawer);
    addSafeListener('btn-cancel-cat-edit', 'click', closeCategoryDrawer);
    
    addSafeListener('edit-account-form', 'submit', handleUpdateAccount);
    addSafeListener('btn-close-acc-drawer', 'click', closeAccountDrawer);
    addSafeListener('btn-cancel-acc-edit', 'click', closeAccountDrawer);
    
    addSafeListener('add-account-form', 'submit', handleAddAccount);
    addSafeListener('btn-close-add-acc-drawer', 'click', closeAddAccountDrawer);
    addSafeListener('btn-cancel-add-acc', 'click', closeAddAccountDrawer);

    addSafeListener('drawer-overlay', 'click', () => {
        closeAccountDrawer();
        closeAddAccountDrawer();
        closeCategoryDrawer();
        closeAddCategoryDrawer();
    });

    addSafeListener('transaction-form', 'submit', handleSaveTransaction);
    addSafeListener('btn-cancel-transaction', 'click', closeTransactionModal);
    addSafeListener('transaction-type', 'change', (e) => {
        const type = e.target.value;
        const sourceWrapper = document.getElementById('source-account-wrapper');
        const destWrapper = document.getElementById('destination-account-wrapper');
        if (type === 'income') {
            sourceWrapper.classList.add('hidden');
            destWrapper.classList.remove('hidden');
            document.getElementById('transaction-source').value = '';
        } else if (type === 'expense') {
            sourceWrapper.classList.remove('hidden');
            destWrapper.classList.add('hidden');
            document.getElementById('transaction-destination').value = '';
        } else { // transfer
            sourceWrapper.classList.remove('hidden');
            destWrapper.classList.remove('hidden');
        }
    });

    addSafeListener('transaction-is-recurring', 'change', (e) => {
        document.getElementById('recurring-fields').classList.toggle('hidden', !e.target.checked);
    });

    addSafeListener('btn-close-filters-modal', 'click', () => document.getElementById('mobile-filters-modal').classList.add('hidden'));
    addSafeListener('btn-close-filters-cancel', 'click', () => document.getElementById('mobile-filters-modal').classList.add('hidden'));
    addSafeListener('btn-apply-filters', 'click', () => {
        import('./dashboard.js').then(m => m.renderTransactions());
        document.getElementById('mobile-filters-modal').classList.add('hidden');
    });
};

// Expose app to window for HTML event handlers
window.app = {
    init,
    setView,
    setViewDate,
    editTransaction,
    deleteTransaction,
    openTransactionModal,
    openMobileActions,
    closeMobileActions,
    closeCategoryActions,
    closeAccountActions,
    renderAccountsList
};

document.addEventListener('DOMContentLoaded', init);
