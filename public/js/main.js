import { state, updateState, defaultCategories, rebuildRecords } from './state.js';
import { setStorageUser } from './storage.js';
import { showNotification, setDataStatusIndicator, setView } from './ui.js';
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
    closeCategoryActions,
    openEditCategory,
    deleteCategory,
    openCategoryActions,
    initCategoryEvents
} from './categories.js';
import { 
    handleAddAccount, 
    closeAccountDrawer, 
    handleUpdateAccount, 
    closeAddAccountDrawer,
    closeAccountActions,
    renderAccountsList,
    openEditAccount,
    deleteAccount,
    openAccountActions
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

import { logout, onUserChanged, auth } from './auth.js';
import { subscribeToAppData, markAccountsBalanceDirty } from './firestore-service.js';
import { firebaseConfig } from './firebase-config.js';

const init = () => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { type: 'module' })
                .then(reg => {
                    console.log('Service Worker registered');
                    // If user is already logged in, init SW
                    if (auth.currentUser) {
                        reg.active?.postMessage({ type: 'INIT_FIREBASE', payload: { config: firebaseConfig } });
                    }
                })
                .catch(err => console.error('SW registration failed:', err));
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'REFRESH_COMPLETE') {
                // Locally clear the dirty flags to stop the spinners immediately
                const { accountIds } = event.data.payload;
                const newAccounts = state.accounts.map(acc => 
                    accountIds.includes(acc.id) ? { ...acc, balanceDirty: false } : acc
                );
                updateState({ accounts: newAccounts });
                router.render();
            }
        });
    }

    // Initialize Router
    router.setNavContainers('nav-desktop', 'nav-mobile');
    router.register(dashboardModule);
    router.register(transactionsModule);
    router.register(accountsModule);
    router.register(categoriesModule);
    router.register(settingsModule);

    setupEventListeners();
    initCategoryEvents();

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
            
            // Init Service Worker with Firebase config once user is authenticated
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.active.postMessage({ type: 'INIT_FIREBASE', payload: { config: firebaseConfig } });
                });
            }
            if (userInfo) userInfo.classList.remove('hidden');
            if (userName) userName.textContent = user.displayName;
            if (userPhoto) userPhoto.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

            if (userInfoMobile) userInfoMobile.classList.remove('hidden');
            if (userNameMobile) userNameMobile.textContent = user.displayName;
            if (userEmailMobile) userEmailMobile.textContent = user.email;
            if (userPhotoMobile) userPhotoMobile.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

            // 1. Subscribe to Firestore for live data and updates
            let isFirstFirestoreUpdate = true;
            subscribeToAppData(user.uid, (newData) => {
                if (isFirstFirestoreUpdate) {
                    // Trigger balance refresh on login if any accounts are dirty OR if no balances exist yet
                    const hasDirtyAccounts = (newData.accounts || []).some(acc => acc.balanceDirty !== false);
                    const hasNoBalances = Object.keys(newData.accountBalances || {}).length === 0;
                    
                    if (hasDirtyAccounts || (hasNoBalances && (newData.accounts || []).length > 0)) {
                        markAccountsBalanceDirty(user.uid);
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

const setViewDate = (date) => {
    const newDate = new Date(date);
    updateState({ viewDate: newDate });
    router.render();
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
    addSafeListener('.mobile-menu-button', 'click', () => {
        const mobileMenu = document.querySelector('.mobile-menu');
        if (mobileMenu) mobileMenu.classList.toggle('hidden');
    }, true);

    addSafeListener('prev-month', 'click', () => {
        const d = new Date(state.viewDate);
        const step = state.monthSelectorConfig.step;
        if (step === 'month') {
            d.setMonth(d.getMonth() - 1);
        } else {
            d.setMonth(d.getMonth() - 3);
        }
        setViewDate(d);
    });
    addSafeListener('next-month', 'click', () => {
        const d = new Date(state.viewDate);
        const step = state.monthSelectorConfig.step;
        if (step === 'month') {
            d.setMonth(d.getMonth() + 1);
        } else {
            d.setMonth(d.getMonth() + 3);
        }
        setViewDate(d);
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
            if (sourceWrapper) sourceWrapper.classList.add('hidden');
            if (destWrapper) destWrapper.classList.remove('hidden');
            document.getElementById('transaction-source').value = '';
        } else if (type === 'expense') {
            if (sourceWrapper) sourceWrapper.classList.remove('hidden');
            if (destWrapper) destWrapper.classList.add('hidden');
            document.getElementById('transaction-destination').value = '';
        } else { // transfer
            if (sourceWrapper) sourceWrapper.classList.remove('hidden');
            if (destWrapper) destWrapper.classList.remove('hidden');
        }
    });

    addSafeListener('transaction-is-recurring', 'change', (e) => {
        const recurringFields = document.getElementById('recurring-fields');
        if (recurringFields) recurringFields.classList.toggle('hidden', !e.target.checked);
    });

    addSafeListener('btn-close-filters-modal', 'click', () => {
        const modal = document.getElementById('mobile-filters-modal');
        if (modal) modal.classList.add('hidden');
    });
    addSafeListener('btn-close-filters-cancel', 'click', () => {
        const modal = document.getElementById('mobile-filters-modal');
        if (modal) modal.classList.add('hidden');
    });
    addSafeListener('btn-apply-filters', 'click', () => {
        import('./dashboard.js').then(m => m.renderTransactions());
        const modal = document.getElementById('mobile-filters-modal');
        if (modal) modal.classList.add('hidden');
    });};

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
    renderAccountsList,
    openEditCategory,
    deleteCategory,
    openCategoryActions,
    openEditAccount,
    deleteAccount,
    openAccountActions
};

document.addEventListener('DOMContentLoaded', init);
