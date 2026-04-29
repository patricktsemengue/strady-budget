import { state, updateState, defaultCategories, rebuildRecords } from './state.js';
import { setStorageUser } from './storage.js';
import { initI18n, t, changeLanguage, getCurrentLanguage, translatePage } from './i18n.js';
import { 
    showNotification, 
    setDataStatusIndicator, 
    setView,
    showOnboardingModal 
} from './ui.js';
import { router } from './app-router.js';

// Modules
import dashboardNewModule from './modules/dashboard-new-module.js';
import transactionsModule from './modules/transactions-module.js';
import accountsModule from './modules/accounts-module.js';
import wealthModule from './modules/wealth-module.js';
import educationModule from './modules/education-module.js';
import categoriesModule from './modules/categories-module.js';
import settingsModule from './modules/settings-module.js';
import { tourModule } from './modules/tour-module.js';

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
import { 
    handleAddWealthEntity,
    openWealthDrawer,
    closeWealthDrawer,
    openWealthDetails,
    closeWealthDetails,
    handleAddValueSnapshot,
    deleteWealthValue,
    deleteWealthEntity
} from './wealth.js';

import { logout, onUserChanged, auth } from './auth.js';
import { 
    subscribeToAppData, 
    markAccountsBalanceDirty, 
    db,
    provisionStarterData,
    updateSettingsInFirestore 
} from './firestore-service.js';
import { calculateBalanceDelta, sweepAccountBalances } from './balance-engine.js';
import { 
    collection, 
    doc, 
    writeBatch, 
    serverTimestamp,
    query,
    where,
    getDocs,
    updateDoc,
    setDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { debounce } from './utils.js';

const init = async () => {
    try {
        console.log('[Main] Initialization started...');
        
        // Global error handler for mobile debugging
        window.onerror = function(msg, url, line, col, error) {
            console.error('[Global Error]', msg, 'at', line, ':', col);
            // alert(`Error: ${msg}\nLine: ${line}`);
            return false;
        };

        // Initialize i18n
        try {
            await initI18n();
            // Translate static parts of index.html
            translatePage();

            // Set active language button
            const currentLng = getCurrentLanguage();
            ['', '-mobile'].forEach(suffix => {
                const btnFr = document.getElementById(`lang-fr${suffix}`);
                const btnEn = document.getElementById(`lang-en${suffix}`);
                if (btnFr && btnEn) {
                    if (currentLng === 'fr') {
                        btnFr.classList.add('bg-white', 'shadow-sm', 'text-indigo-600', 'dark:bg-slate-800', 'dark:text-indigo-400');
                        btnEn.classList.add('text-slate-400', 'dark:text-slate-500');
                    } else {
                        btnEn.classList.add('bg-white', 'shadow-sm', 'text-indigo-600', 'dark:bg-slate-800', 'dark:text-indigo-400');
                        btnFr.classList.add('text-slate-400', 'dark:text-slate-500');
                    }
                }
            });
        } catch (i18nErr) {
            console.warn('[Main] i18n initialization failed, using fallbacks:', i18nErr);
        }

        // Initialize Theme
        const savedTheme = localStorage.getItem('strady_theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        updateThemeToggleIcons(isDark);

        // Initialize Sidebar State
        const isSidebarCollapsed = localStorage.getItem('strady_sidebar_collapsed') === 'true';
        if (isSidebarCollapsed) {
            const sidebar = document.getElementById('sidebar');
            const mainWrapper = document.getElementById('main-wrapper');
            const icon = document.getElementById('sidebar-toggle-icon');
            if (sidebar) sidebar.classList.add('collapsed');
            if (mainWrapper) mainWrapper.classList.add('sidebar-collapsed');
            if (icon) icon.className = 'fa-solid fa-chevron-right text-[10px]';
        }

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js', { type: 'module' })
                    .then(reg => {
                        console.log('Service Worker registered');
                        if (auth.currentUser) {
                            reg.active?.postMessage({
                                type: 'INIT_FIREBASE',
                                payload: { config: firebaseConfig }
                            });
                        }
                    })
                    .catch(err => console.error('SW registration failed:', err));
            });

            navigator.serviceWorker.addEventListener('message', async (event) => {
                if (event.data.type === 'REFRESH_COMPLETE') {
                    const { accountIds } = event.data.payload;
                    const newAccounts = state.accounts.map(acc => 
                        accountIds.includes(acc.id) ? { ...acc, balanceDirty: false } : acc
                    );
                    updateState({ accounts: newAccounts });
                    router.render();
                } else if (event.data.type === 'REFRESH_FAILED') {
                    const { userId, action, data, error } = event.data.payload;
                    try {
                        if (action === 'DELTA') {
                            await calculateBalanceDelta(db, userId, data.accountId, data.amount, data.date, getDocs, updateDoc, setDoc, doc, collection, query, where, orderBy, limit, serverTimestamp);
                        } else if (action === 'SWEEP') {
                            await sweepAccountBalances(db, userId, data.accountIds, getDocs, setDoc, updateDoc, doc, collection, query, where, orderBy, limit, serverTimestamp);
                        }
                        const batch = writeBatch(db);
                        const targets = action === 'DELTA' ? [data.accountId] : data.accountIds;
                        targets.forEach(id => {
                            const accRef = doc(db, `users/${userId}/accounts`, id);
                            batch.update(accRef, { balanceDirty: false, updated_at: serverTimestamp() });
                        });
                        await batch.commit();
                    } catch (fallbackError) {
                        console.error("[Main] Fallback refresh failed:", fallbackError);
                    }
                }
            });
        }

        // Initialize Router
        router.setNavContainers('nav-desktop', 'nav-mobile');
        
        // Register Modules
        router.register(dashboardNewModule);
        router.register(wealthModule);
        router.register(educationModule);
        router.register(transactionsModule);
        router.register(accountsModule);
        router.register(categoriesModule);
        router.register(settingsModule);

        if (sessionStorage.getItem('strady_trigger_tour') === 'true') {
            sessionStorage.removeItem('strady_trigger_tour');
            setTimeout(() => tourModule.start(), 500);
        }

        setupEventListeners();
        initCategoryEvents();

        const debouncedUpdateAndRender = debounce((newData) => {
            updateState({
                accounts: newData.accounts || [],
                transactions: newData.transactions || [],
                categories: newData.categories || defaultCategories,
                recurringTemplates: newData.recurringTemplates || [],
                assets: newData.assets || [],
                assetValues: newData.assetValues || [],
                liabilities: newData.liabilities || [],
                liabilityValues: newData.liabilityValues || [],
                months: newData.months || {},
                accountBalances: newData.accountBalances || {},
                onboarding: newData.onboarding || null,
                emergencyFundMultiplier: newData.emergencyFundMultiplier || 3,
                monthSelectorConfig: newData.monthSelectorConfig || state.monthSelectorConfig,
                displayCurrency: newData.displayCurrency || 'EUR',
                exchangeRates: newData.exchangeRates || {}
            });
            if (newData.categories && newData.categories.length === 0) updateState({ categories: defaultCategories });
            rebuildRecords(newData.transactions || [], newData.months || {});
            router.render();
        }, 50);

        onUserChanged(async (user) => {
            const userInfo = document.getElementById('user-info');
            const userName = document.getElementById('user-name');
            const userPhoto = document.getElementById('user-photo');
            const userInfoMobile = document.getElementById('user-info-mobile');
            const userNameMobile = document.getElementById('user-name-mobile');
            const userEmailMobile = document.getElementById('user-email-mobile');
            const userPhotoMobile = document.getElementById('user-photo-mobile');
            const mainContent = document.querySelector('main');
            const overlay = document.getElementById('loading-overlay');

            if (user) {
                setStorageUser(user.uid);
                const syncSWAuth = async (u) => {
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.ready.then(reg => {
                            reg.active?.postMessage({ type: 'INIT_FIREBASE', payload: { config: firebaseConfig } });
                        });
                    }
                };
                syncSWAuth(user);
                auth.onIdTokenChanged(async (u) => { if (u) syncSWAuth(u); });

                if (userInfo) userInfo.classList.remove('hidden');
                if (userName) userName.textContent = user.displayName;
                if (userPhoto) userPhoto.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                if (userInfoMobile) userInfoMobile.classList.remove('hidden');
                if (userNameMobile) userNameMobile.textContent = user.displayName;
                if (userEmailMobile) userEmailMobile.textContent = user.email;
                if (userPhotoMobile) userPhotoMobile.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

                let isFirstFirestoreUpdate = true;
                subscribeToAppData(user.uid, (newData) => {
                    if (isFirstFirestoreUpdate) {
                        const hasDirtyAccounts = (newData.accounts || []).some(acc => acc.balanceDirty !== false);
                        const hasNoBalances = Object.keys(newData.accountBalances || {}).length === 0;
                        if (hasDirtyAccounts || (hasNoBalances && (newData.accounts || []).length > 0)) markAccountsBalanceDirty(user.uid);
                        const isNewUserSession = sessionStorage.getItem('strady_is_new_user_session') === 'true';
                        if ((newData.accounts || []).length === 0 && (isNewUserSession || !newData.onboarding)) {
                            showOnboardingModal(async (choice) => {
                                if (choice === 'starter') {
                                    try { await provisionStarterData(user.uid); showNotification("Starter Pack installé !"); tourModule.start(); }
                                    catch (err) { console.error(err); showNotification("Erreur Starter Pack", "error"); }
                                } else {
                                    try { await updateSettingsInFirestore(user.uid, 'onboarding', { starterPackApplied: false, onboardingComplete: true, updated_at: serverTimestamp() }); }
                                    catch (err) { console.error(err); }
                                }
                                sessionStorage.removeItem('strady_is_new_user_session');
                            });
                        }
                        isFirstFirestoreUpdate = false;
                    }
                    debouncedUpdateAndRender(newData);
                });

                const initialView = window.location.hash.substring(1) || 'education';
                router.setView(initialView);
                if (mainContent) mainContent.classList.remove('hidden');
                if (overlay) overlay.classList.add('hidden');
            } else {
                setStorageUser(null);
                if (mainContent) mainContent.classList.add('hidden');
                window.location.href = 'login.html';
            }
        });

        window.addEventListener('hashchange', () => {
            const view = window.location.hash.substring(1) || 'education';
            router.setView(view);
        });

    } catch (err) {
        console.error('[Main] Initialization failed:', err);
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = `<div class="p-10 text-center text-red-600 font-bold">Erreur de chargement: ${err.message}</div>`;
            mainContent.classList.remove('hidden');
        }
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }
};

const setViewDate = (date) => {
    const newDate = new Date(date);
    updateState({ viewDate: newDate });
    router.render();
};

const updateThemeToggleIcons = (isDark) => {
    const icons = document.querySelectorAll('#theme-toggle i, .theme-toggle-mobile i');
    icons.forEach(icon => {
        icon.className = isDark ? 'fa-solid fa-sun text-xs' : 'fa-solid fa-moon text-xs';
    });
};

const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('strady_theme', isDark ? 'dark' : 'light');
    updateThemeToggleIcons(isDark);
};

const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('main-wrapper');
    const icon = document.getElementById('sidebar-toggle-icon');
    
    const isCollapsed = sidebar.classList.toggle('collapsed');
    mainWrapper.classList.toggle('sidebar-collapsed', isCollapsed);
    
    if (icon) {
        icon.className = isCollapsed ? 'fa-solid fa-chevron-right text-[10px]' : 'fa-solid fa-chevron-left text-[10px]';
    }
    
    localStorage.setItem('strady_sidebar_collapsed', isCollapsed);
};

const setupEventListeners = () => {
    const handleLogout = async () => {
        if (confirm(t('confirm.logout'))) {
            try { await logout(); showNotification(t('common.success_logout')); }
            catch (error) { showNotification(t('common.error_logout'), "error"); }
        }
    };

    const addSafeListener = (selector, event, handler, isQuerySelector = false) => {
        const element = isQuerySelector ? document.querySelector(selector) : document.getElementById(selector);
        if (element) element.addEventListener(event, handler);
    };

    addSafeListener('btn-logout', 'click', handleLogout);
    addSafeListener('btn-logout-mobile', 'click', handleLogout);
    addSafeListener('.mobile-menu-button', 'click', () => {
        const mobileMenu = document.querySelector('.mobile-menu');
        if (mobileMenu) mobileMenu.classList.toggle('hidden');
    }, true);

    addSafeListener('prev-month', 'click', () => {
        const d = new Date(state.viewDate);
        if (state.monthSelectorConfig.step === 'month') d.setMonth(d.getMonth() - 1);
        else d.setMonth(d.getMonth() - 3);
        setViewDate(d);
    });
    addSafeListener('next-month', 'click', () => {
        const d = new Date(state.viewDate);
        if (state.monthSelectorConfig.step === 'month') d.setMonth(d.getMonth() + 1);
        else d.setMonth(d.getMonth() + 3);
        setViewDate(d);
    });

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
        closeAccountDrawer(); closeAddAccountDrawer(); closeCategoryDrawer(); closeAddCategoryDrawer(); closeWealthDrawer();
    });
    addSafeListener('transaction-form', 'submit', handleSaveTransaction);
    addSafeListener('btn-cancel-transaction', 'click', closeTransactionModal);
    addSafeListener('transaction-is-recurring', 'change', (e) => {
        const fields = document.getElementById('recurring-fields');
        if (fields) fields.classList.toggle('hidden', !e.target.checked);
    });
    addSafeListener('wealth-add-form', 'submit', handleAddWealthEntity);
    addSafeListener('wealth-snapshot-form', 'submit', handleAddValueSnapshot);
    addSafeListener('adjustment-form', 'submit', (e) => import('./accounts.js').then(m => m.handleAdjustmentSubmit(e)));
    addSafeListener('transfer-form', 'submit', (e) => import('./accounts.js').then(m => m.handleTransferSubmit(e)));
};

window.app = {
    init, changeLanguage, toggleTheme, toggleSidebar, startTour: () => tourModule.start(),
    updateCurrencySettings: (updates) => import('./settings.js').then(m => m.updateCurrencySettings(updates)),
    addExchangeRate: (code) => import('./settings.js').then(m => m.addExchangeRate(code)),
    updateExchangeRate: (code, val) => import('./settings.js').then(m => m.updateExchangeRate(code, val)),
    deleteExchangeRate: (code) => import('./settings.js').then(m => m.deleteExchangeRate(code)),
    openWealthEvolution: () => import('./dashboard-new.js').then(m => m.openWealthEvolution()),
    setView, setViewDate, editTransaction, deleteTransaction, openTransactionModal,
    openMobileActions, closeMobileActions, closeCategoryActions, closeAccountActions,
    renderAccountsList, openEditCategory, deleteCategory, openCategoryActions,
    openEditAccount, deleteAccount, openAccountActions, openWealthDrawer, closeWealthDrawer,
    openAddAccountDrawer: () => import('./accounts.js').then(m => m.openAddAccountDrawer()),
    openAddCategoryDrawer: () => import('./categories.js').then(m => m.openAddCategoryDrawer()),
    openWealthDetails, closeWealthDetails, deleteWealthValue, deleteWealthEntity,
    dismissHelp: (id) => router.dismissHelp(id),
    showHelp: (id) => router.showHelp(id),
    setNatureFilter: (nature) => import('./dashboard.js').then(m => m.setNatureFilter(nature)),
    openAdjustmentModal: (id) => import('./accounts.js').then(m => m.openAdjustmentModal(id)),
    closeAdjustmentModal: () => import('./accounts.js').then(m => m.closeAdjustmentModal()),
    openTransferModal: () => import('./accounts.js').then(m => m.openTransferModal()),
    closeTransferModal: () => import('./accounts.js').then(m => m.closeTransferModal()),
    setSettingPreset: (type) => import('./settings.js').then(m => m.setSettingPreset(type)),
    updateEFMultiplier: (multiplier) => import('./settings.js').then(m => m.updateEFMultiplier(multiplier)),
    toggleCategoryGroup: (catId) => import('./dashboard.js').then(m => m.toggleCategoryGroup(catId)),
    toggleAllCategoryGroups: (expand) => import('./dashboard.js').then(m => m.toggleAllCategoryGroups(expand)),
    openKPIInfo: (key) => import('./dashboard-new.js').then(m => m.openKPIInfo(key)),
    closeInfoModal: () => import('./dashboard-new.js').then(m => m.closeInfoModal()),
    jumpToSection: (id) => import('./dashboard-new.js').then(m => m.jumpToSection(id))
};

document.addEventListener('DOMContentLoaded', init);
