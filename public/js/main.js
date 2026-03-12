import { state, updateState, defaultCategories, mockAccounts, mockRecurring, mockRecords } from './state.js';
import { loadState, saveState, setStorageUser } from './storage.js';
import { setView, setViewDate, render, showNotification } from './ui.js';
import { renderTransactions, clotureMois } from './dashboard.js';
import { handleAddCategory, openEditCategory, closeCategoryDrawer, handleUpdateCategory, deleteCategory } from './categories.js';
import { handleAddAccount, openEditAccount, closeAccountDrawer, handleUpdateAccount, deleteAccount } from './accounts.js';
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

const init = () => {
    setupEventListeners();

    // Firebase Auth listener
    onUserChanged((user) => {
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

            // Load data for this specific user
            const savedState = loadState(user.uid);
            if (savedState) {
                updateState({ ...savedState, viewDate: new Date(savedState.viewDate || new Date()) });
            } else {
                updateState({
                    accounts: mockAccounts,
                    recurring: mockRecurring,
                    records: mockRecords,
                    categories: defaultCategories
                });
            }
            if (!state.categories || state.categories.length === 0) {
                updateState({ categories: defaultCategories });
            }

            const initialView = window.location.hash.substring(1) || 'dashboard';
            setView(initialView, true);
            
            // Show content
            if (mainContent) mainContent.classList.remove('hidden');
            render(); 
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
    document.getElementById('prev-month').addEventListener('click', () => { 
        const newDate = new Date(state.viewDate.setMonth(state.viewDate.getMonth() - 1));
        setViewDate(newDate); 
    });
    document.getElementById('next-month').addEventListener('click', () => { 
        const newDate = new Date(state.viewDate.setMonth(state.viewDate.getMonth() + 1));
        setViewDate(newDate); 
    });

    document.getElementById('add-category-form').addEventListener('submit', handleAddCategory);
    
    // Category Edit Drawer
    document.getElementById('edit-category-form').addEventListener('submit', handleUpdateCategory);
    document.getElementById('btn-close-cat-drawer').addEventListener('click', closeCategoryDrawer);
    document.getElementById('btn-cancel-cat-edit').addEventListener('click', closeCategoryDrawer);
    // Note: drawer-overlay click is already handled by account drawer setup if they use the same overlay
    document.getElementById('add-account-form').addEventListener('submit', handleAddAccount);
    
    // Account Edit Drawer
    document.getElementById('edit-account-form').addEventListener('submit', handleUpdateAccount);
    document.getElementById('btn-close-acc-drawer').addEventListener('click', closeAccountDrawer);
    document.getElementById('btn-cancel-acc-edit').addEventListener('click', closeAccountDrawer);
    document.getElementById('drawer-overlay').addEventListener('click', closeAccountDrawer);
    
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
    deleteAccount
};

document.addEventListener('DOMContentLoaded', init);
