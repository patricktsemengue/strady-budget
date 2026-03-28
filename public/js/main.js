import { state, updateState, defaultCategories, rebuildRecords } from './state.js';
import { setStorageUser, currentUserId, loadDataFromCache } from './storage.js';
import { setView, setViewDate, render, showNotification, setDataStatusIndicator } from './ui.js';
import { renderTransactions, clotureMois } from './dashboard.js';
import { getMonthKey } from './utils.js';
import { 
    handleAddCategory, 
    openEditCategory, 
    closeCategoryDrawer, 
    handleUpdateCategory, 
    deleteCategory,
    openAddCategoryDrawer,
    closeAddCategoryDrawer
} from './categories.js';
import { 
    handleAddAccount, 
    openEditAccount, 
    closeAccountDrawer, 
    handleUpdateAccount, 
    deleteAccount,
    openAddAccountDrawer,
    closeAddAccountDrawer
} from './accounts.js';
import { 
    openTransactionModal, 
    closeTransactionModal, 
    handleSaveTransaction, 
    editTransaction, 
    duplicateTransaction, 
    deleteTransaction 
} from './transactions.js';
import { handleReset, exportCSV, importCSV, exportAccountsCSV, importAccountsCSV } from './data.js';
import { login, logout, onUserChanged } from './auth.js';
import { subscribeToAppData, generateJitTransactions } from './firestore-service.js';

const init = () => {
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

            // Trigger JIT generation for current month
            const initialMonthKey = getMonthKey(state.viewDate);
            await generateJitTransactions(user.uid, initialMonthKey);

            // 2. Subscribe to Firestore for live data and updates
            let isFirstFirestoreUpdate = true;
            subscribeToAppData(user.uid, (newData) => {
                if (isFirstFirestoreUpdate) {
                    if (cachedData) { // Only show the "live" transition if we started from cache
                        setDataStatusIndicator('live');
                    }
                    isFirstFirestoreUpdate = false;
                }
                // This callback will be triggered by Firestore, updating the UI and the cache.
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

                // Rebuild records into legacy format
                rebuildRecords(newData.transactions || [], newData.months || {});
                
                render();
            });

            const initialView = window.location.hash.substring(1) || 'dashboard';
            setView(initialView, true);
            
            // Show content
            if (mainContent) mainContent.classList.remove('hidden');
        } else {
            // User is signed out, redirect to login page
            setStorageUser(null);
            if (mainContent) mainContent.classList.add('hidden');
            window.location.href = 'login.html';
        }
    });
};

const setupEventListeners = () => {

    // Auth listeners
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

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const logoutBtnMobile = document.getElementById('btn-logout-mobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', handleLogout);
    }

    const logoutBtnSettings = document.getElementById('btn-logout-settings');
    if (logoutBtnSettings) {
        logoutBtnSettings.addEventListener('click', handleLogout);
    }

    const addSafeListener = (selector, event, handler, isQuerySelector = false) => {
        const element = isQuerySelector ? document.querySelector(selector) : document.getElementById(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    };

    addSafeListener('nav-dashboard', 'click', () => {
        console.log("Menu click: Dashboard");
        setView('dashboard');
    });
    addSafeListener('nav-settings', 'click', () => {
        console.log("Menu click: Settings");
        setView('settings');
    });
    addSafeListener('.mobile-menu-button', 'click', () => document.querySelector('.mobile-menu').classList.toggle('hidden'), true);
    addSafeListener('nav-dashboard-mobile', 'click', () => { 
        console.log("Mobile Menu click: Dashboard");
        setView('dashboard'); 
        document.querySelector('.mobile-menu').classList.add('hidden'); 
    });
    addSafeListener('nav-settings-mobile', 'click', () => { 
        console.log("Mobile Menu click: Settings");
        setView('settings'); 
        document.querySelector('.mobile-menu').classList.add('hidden'); 
    });

    addSafeListener('filter-category', 'change', renderTransactions);
    addSafeListener('filter-account', 'change', renderTransactions);
    addSafeListener('sort-order', 'change', renderTransactions);
    addSafeListener('prev-month', 'click', () => { 
        const newDate = new Date(state.viewDate.setMonth(state.viewDate.getMonth() - 1));
        setViewDate(newDate); 
    });
    addSafeListener('next-month', 'click', () => { 
        const newDate = new Date(state.viewDate.setMonth(state.viewDate.getMonth() + 1));
        setViewDate(newDate); 
    });

    // Category Drawers
    addSafeListener('add-category-form', 'submit', handleAddCategory);
    addSafeListener('btn-close-add-cat-drawer', 'click', closeAddCategoryDrawer);
    addSafeListener('btn-cancel-add-cat', 'click', closeAddCategoryDrawer);

    addSafeListener('edit-category-form', 'submit', handleUpdateCategory);
    addSafeListener('btn-close-cat-drawer', 'click', closeCategoryDrawer);
    addSafeListener('btn-cancel-cat-edit', 'click', closeCategoryDrawer);
    
    // Account Drawers
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
    
    addSafeListener('export-transactions-csv', 'click', exportCSV);
    addSafeListener('import-transactions-csv', 'click', () => document.getElementById('csv-import-input').click());
    addSafeListener('csv-import-input', 'change', importCSV);
    
    addSafeListener('export-accounts-csv', 'click', exportAccountsCSV);
    addSafeListener('import-accounts-csv', 'click', () => document.getElementById('csv-import-acc-input').click());
    addSafeListener('csv-import-acc-input', 'change', importAccountsCSV);
    
    addSafeListener('reset-button', 'click', handleReset);
    addSafeListener('btn-cloture', 'click', clotureMois);

    // Transaction Modal
    addSafeListener('transaction-form', 'submit', handleSaveTransaction);
    addSafeListener('btn-cancel-transaction', 'click', closeTransactionModal);
    addSafeListener('transaction-type', 'change', (e) => {
        const type = e.target.value;
        const sourceWrapper = document.getElementById('source-account-wrapper');
        const destWrapper = document.getElementById('destination-account-wrapper');
        if (type === 'income') {
            sourceWrapper.classList.add('hidden');
            destWrapper.classList.remove('hidden');
            document.getElementById('transaction-source').value = 'external';
        } else if (type === 'expense') {
            sourceWrapper.classList.remove('hidden');
            destWrapper.classList.add('hidden');
            document.getElementById('transaction-destination').value = 'external';
        } else { // transfer
            sourceWrapper.classList.remove('hidden');
            destWrapper.classList.remove('hidden');
        }
    });

    addSafeListener('transaction-is-recurring', 'change', (e) => {
        document.getElementById('recurring-fields').classList.toggle('hidden', !e.target.checked);
    });
};

// Expose app to window for HTML event handlers
window.app = {
    init,
    setView,
    setViewDate,
    openEditCategory,
    deleteCategory,
    editTransaction,
    duplicateTransaction,
    deleteTransaction,
    openTransactionModal,
    clotureMois,
    openEditAccount,
    deleteAccount,
    openAddAccountDrawer,
    openAddCategoryDrawer
};

document.addEventListener('DOMContentLoaded', init);
