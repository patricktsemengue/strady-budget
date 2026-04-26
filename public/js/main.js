import { state, updateState, defaultCategories, rebuildRecords } from './state.js';
import { setStorageUser } from './storage.js';
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
import horizonModule from './modules/horizon-module.js';
import treasuryHorizonModule from './modules/treasury-horizon-module.js';
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
import { initI18n, t, changeLanguage } from './i18n.js';

const init = async () => {
    // Initialize i18n first
    await initI18n();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { type: 'module' })
                .then(reg => {
                    console.log('Service Worker registered');
                    // If user is already logged in, init SW
                    if (auth.currentUser) {
                        reg.active?.postMessage({
                            type: 'INIT_FIREBASE',
                            payload: { config: firebaseConfig }
                        });
                    }                })
                .catch(err => console.error('SW registration failed:', err));
        });

        navigator.serviceWorker.addEventListener('message', async (event) => {
            if (event.data.type === 'REFRESH_COMPLETE') {
                const { accountIds } = event.data.payload;
                console.log('[Main] Balance refresh complete for accounts:', accountIds);
                // Locally clear the dirty flags to stop the spinners immediately
                const newAccounts = state.accounts.map(acc => 
                    accountIds.includes(acc.id) ? { ...acc, balanceDirty: false } : acc
                );
                updateState({ accounts: newAccounts });
                router.render();
            } else if (event.data.type === 'REFRESH_FAILED') {
                const { userId, action, data, error } = event.data.payload;
                console.warn(`[Main] SW refresh failed (${action}):`, error, " - Falling back to main thread.");
                
                // Trigger the fallback immediately in the main thread
                try {
                    if (action === 'DELTA') {
                        await calculateBalanceDelta(
                            db, userId, data.accountId, data.amount, data.date,
                            getDocs, updateDoc, setDoc, doc, collection, query, where, orderBy, limit, serverTimestamp
                        );
                    } else if (action === 'SWEEP') {
                        await sweepAccountBalances(
                            db, userId, data.accountIds,
                            getDocs, setDoc, updateDoc, doc, collection, query, where, orderBy, limit, serverTimestamp
                        );
                    }
                    
                    // Clear the dirty flag manually after fallback
                    const batch = writeBatch(db);
                    const targets = action === 'DELTA' ? [data.accountId] : data.accountIds;
                    targets.forEach(id => {
                        const accRef = doc(db, `users/${userId}/accounts`, id);
                        batch.update(accRef, { balanceDirty: false, updated_at: serverTimestamp() });
                    });
                    await batch.commit();
                    console.log(`[Main] Fallback ${action} complete.`);
                } catch (fallbackError) {
                    console.error("[Main] Fallback refresh failed:", fallbackError);
                }
            }
        });
    }

    // Initialize Router
    router.setNavContainers('nav-desktop', 'nav-mobile');
    
    // 1. Vision Stratégique
    router.register(dashboardNewModule);
    router.register(wealthModule);
    router.register(educationModule);

    // 2. Pilotage Opérationnel
    router.register(transactionsModule);
    router.register(accountsModule);
    router.register(horizonModule);
    router.register(treasuryHorizonModule);

    // 3. Configuration & Archives
    router.register(categoriesModule);
    router.register(settingsModule);

    // Check for pending tour trigger (e.g. after factory reset)
    if (sessionStorage.getItem('strady_trigger_tour') === 'true') {
        sessionStorage.removeItem('strady_trigger_tour');
        setTimeout(() => tourModule.start(), 500);
    }

    setupEventListeners();
    initCategoryEvents();

    // Optimization: Debounce render to group rapid Firestore updates
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
            monthSelectorConfig: newData.monthSelectorConfig || state.monthSelectorConfig
        });
        
        if (newData.categories && newData.categories.length === 0) {
            updateState({ categories: defaultCategories });
        }

        rebuildRecords(newData.transactions || [], newData.months || {});
        router.render();
    }, 50);

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
            const syncSWAuth = async (u) => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(reg => {
                        reg.active?.postMessage({ 
                            type: 'INIT_FIREBASE', 
                            payload: { config: firebaseConfig } 
                        });
                    });
                }
            };

            syncSWAuth(user);
            // Also sync on token refresh
            auth.onIdTokenChanged(async (u) => {
                if (u) syncSWAuth(u);
            });

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

                    // Onboarding Detection
                    const isNewUserSession = sessionStorage.getItem('strady_is_new_user_session') === 'true';
                    const noAccounts = (newData.accounts || []).length === 0;
                    const noOnboarding = !newData.onboarding;

                    if (noAccounts && (isNewUserSession || noOnboarding)) {
                        showOnboardingModal(async (choice) => {
                            if (choice === 'starter') {
                                try {
                                    await provisionStarterData(user.uid);
                                    showNotification("Starter Pack installé avec succès !");
                                    // Start the tour
                                    tourModule.start();
                                } catch (err) {
                                    console.error(err);
                                    showNotification("Erreur lors de l'installation du Starter Pack", "error");
                                }
                            } else {
                                // Start from scratch
                                try {
                                    await updateSettingsInFirestore(user.uid, 'onboarding', { 
                                        starterPackApplied: false, 
                                        onboardingComplete: true,
                                        updated_at: serverTimestamp() 
                                    });
                                    showNotification("C'est parti ! Vous commencez de zéro.");
                                } catch (err) {
                                    console.error(err);
                                }
                            }
                            sessionStorage.removeItem('strady_is_new_user_session');
                        });
                    }
                    
                    isFirstFirestoreUpdate = false;
                }
                
                debouncedUpdateAndRender(newData);
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
        if (confirm(t('confirm.logout'))) {
            try {
                await logout();
                showNotification(t('common.success_logout'));
            } catch (error) {
                showNotification(t('common.error_logout'), "error");
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
        closeWealthDrawer();
    });

    addSafeListener('transaction-form', 'submit', handleSaveTransaction);
    addSafeListener('btn-cancel-transaction', 'click', closeTransactionModal);

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
    });

    addSafeListener('wealth-add-form', 'submit', handleAddWealthEntity);
    addSafeListener('wealth-snapshot-form', 'submit', handleAddValueSnapshot);
    addSafeListener('adjustment-form', 'submit', (e) => import('./accounts.js').then(m => m.handleAdjustmentSubmit(e)));
    addSafeListener('transfer-form', 'submit', (e) => import('./accounts.js').then(m => m.handleTransferSubmit(e)));
};

// Expose app to window for HTML event handlers
window.app = {
    init,
    changeLanguage,
    startTour: () => tourModule.start(),
    openWealthEvolution: () => import('./dashboard-new.js').then(m => m.openWealthEvolution()),
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
    openAccountActions,
    openWealthDrawer,
    closeWealthDrawer,
    openWealthDetails,
    closeWealthDetails,
    deleteWealthValue,
    deleteWealthEntity,
    setNatureFilter: (nature) => import('./dashboard.js').then(m => m.setNatureFilter(nature)),
    openAdjustmentModal: (id) => import('./accounts.js').then(m => m.openAdjustmentModal(id)),
    closeAdjustmentModal: () => import('./accounts.js').then(m => m.closeAdjustmentModal()),
    openTransferModal: () => import('./accounts.js').then(m => m.openTransferModal()),
    closeTransferModal: () => import('./accounts.js').then(m => m.closeTransferModal()),
    setSettingPreset: (type) => import('./settings.js').then(m => m.setSettingPreset(type)),
    updateEFMultiplier: (multiplier) => import('./settings.js').then(m => m.updateEFMultiplier(multiplier)),
    toggleCategoryGroup: (catId) => import('./dashboard.js').then(m => m.toggleCategoryGroup(catId)),
    toggleAllCategoryGroups: (expand) => import('./dashboard.js').then(m => m.toggleAllCategoryGroups(expand))
};

document.addEventListener('DOMContentLoaded', init);
