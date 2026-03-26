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
                    recurring: cachedData.recurringTemplates || [],
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
                    recurring: newData.recurringTemplates || [],
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

    document.getElementById('nav-dashboard').addEventListener('click', () => {
        console.log("Menu click: Dashboard");
        setView('dashboard');
    });
    document.getElementById('nav-settings').addEventListener('click', () => {
        console.log("Menu click: Settings");
        setView('settings');
    });
    document.querySelector('.mobile-menu-button').addEventListener('click', () => document.querySelector('.mobile-menu').classList.toggle('hidden'));
    document.getElementById('nav-dashboard-mobile').addEventListener('click', () => { 
        console.log("Mobile Menu click: Dashboard");
        setView('dashboard'); 
        document.querySelector('.mobile-menu').classList.add('hidden'); 
    });
    document.getElementById('nav-settings-mobile').addEventListener('click', () => { 
        console.log("Mobile Menu click: Settings");
        setView('settings'); 
        document.querySelector('.mobile-menu').classList.add('hidden'); 
    });

    document.getElementById('filter-category').addEventListener('change', renderTransactions);
    document.getElementById('filter-account').addEventListener('change', renderTransactions);
    document.getElementById('sort-order').addEventListener('change', renderTransactions);
    document.getElementById('prev-month').addEventListener('click', () => { 
        const newDate = new Date(state.viewDate.setMonth(state.viewDate.getMonth() - 1));
        setViewDate(newDate); 
    });
    document.getElementById('next-month').addEventListener('click', () => { 
        const newDate = new Date(state.viewDate.setMonth(state.viewDate.getMonth() + 1));
        setViewDate(newDate); 
    });

    // Category Drawers
    document.getElementById('add-category-form').addEventListener('submit', handleAddCategory);
    document.getElementById('btn-close-add-cat-drawer').addEventListener('click', closeAddCategoryDrawer);
    document.getElementById('btn-cancel-add-cat').addEventListener('click', closeAddCategoryDrawer);

    document.getElementById('edit-category-form').addEventListener('submit', handleUpdateCategory);
    document.getElementById('btn-close-cat-drawer').addEventListener('click', closeCategoryDrawer);
    document.getElementById('btn-cancel-cat-edit').addEventListener('click', closeCategoryDrawer);
    
    // Account Drawers
    document.getElementById('edit-account-form').addEventListener('submit', handleUpdateAccount);
    document.getElementById('btn-close-acc-drawer').addEventListener('click', closeAccountDrawer);
    document.getElementById('btn-cancel-acc-edit').addEventListener('click', closeAccountDrawer);
    
    document.getElementById('add-account-form').addEventListener('submit', handleAddAccount);
    document.getElementById('btn-close-add-acc-drawer').addEventListener('click', closeAddAccountDrawer);
    document.getElementById('btn-cancel-add-acc').addEventListener('click', closeAddAccountDrawer);

    document.getElementById('drawer-overlay').addEventListener('click', () => {
        closeAccountDrawer();
        closeAddAccountDrawer();
        closeCategoryDrawer();
        closeAddCategoryDrawer();
    });
    
    document.getElementById('export-transactions-csv').addEventListener('click', exportCSV);
    document.getElementById('import-transactions-csv').addEventListener('click', () => document.getElementById('csv-import-input').click());
    document.getElementById('csv-import-input').addEventListener('change', importCSV);
    
    document.getElementById('export-accounts-csv').addEventListener('click', exportAccountsCSV);
    document.getElementById('import-accounts-csv').addEventListener('click', () => document.getElementById('csv-import-acc-input').click());
    document.getElementById('csv-import-acc-input').addEventListener('change', importAccountsCSV);
    
    document.getElementById('reset-button').addEventListener('click', handleReset);
    document.getElementById('btn-cloture').addEventListener('click', clotureMois);

    // Transaction Modal
    document.getElementById('transaction-form').addEventListener('submit', handleSaveTransaction);
    document.getElementById('btn-cancel-transaction').addEventListener('click', closeTransactionModal);
    document.getElementById('transaction-type').addEventListener('change', (e) => {
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

    document.getElementById('transaction-is-recurring').addEventListener('change', (e) => {
        const recurringFields = document.getElementById('recurring-fields');
        if (e.target.checked) {
            recurringFields.classList.remove('hidden');
        } else {
            recurringFields.classList.add('hidden');
        }
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
