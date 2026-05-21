import { t } from '../i18n.js';

export default {
    id: 'hub',
    hidden: true, // Don't show in regular nav
    appId: 'hub',
    getTemplate: () => `
        <div class="max-w-6xl mx-auto px-4 py-12 animate-fadeIn relative">
            <!-- Subtle Hub Utilities (Corner System Door) -->
            <div class="absolute top-0 right-4 flex items-center gap-2">
                <button onclick="window.app.setView('settings')" class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" title="Paramètres">
                    <i class="fa-solid fa-gear"></i>
                </button>
                <button id="btn-backup-json-hub-ghost" class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" title="Sauvegarde">
                    <i class="fa-solid fa-cloud-arrow-down"></i>
                </button>
                <button id="btn-logout-hub" class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all" title="${t('settings.maintenance.logout') || 'Déconnexion'}">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>

            <div class="text-center mb-16">
                <!-- Status Pill (Quick Snapshot) -->
                <div class="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-8 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                    <i class="fa-solid fa-calendar-check text-indigo-500"></i>
                    <span id="hub-status-date">...</span>
                    <span class="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                    <span id="hub-status-wealth">Strady Portal</span>
                </div>

                <!-- Branding Displacement -->
                <div class="flex flex-col items-center gap-2 mb-6">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-500/20">
                        <span class="font-black">S</span>
                    </div>
                    <div class="logo dark:text-white !gap-1 scale-110">
                        <span class="logo-trady !text-2xl font-black tracking-tighter">trady</span>
                    </div>
                </div>

                <h1 class="text-4xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
                    ${t('hub.welcome') || 'Bienvenue sur Strady'}
                </h1>
                <p class="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
                    ${t('hub.subtitle') || 'Choisissez votre outil pour commencer votre gestion financière.'}
                </p>
            </div>

            <div class="flex flex-wrap justify-center gap-12 md:gap-20">
                <!-- The Daily Ledger -->
                <button onclick="window.app.router.switchApp('ledger')" class="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95">
                    <div class="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[2rem] md:rounded-[2.5rem] shadow-xl group-hover:shadow-indigo-500/20 flex items-center justify-center text-white text-4xl md:text-5xl transition-all relative overflow-hidden ring-4 ring-white dark:ring-slate-900 ring-offset-4 ring-offset-transparent">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <i class="fa-solid fa-list-check drop-shadow-lg"></i>
                    </div>
                    <div class="text-center">
                        <h2 class="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">${t('apps.ledger.name') || 'Le Grand Livre'}</h2>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">${t('hub.tag_operations') || 'Opérations'}</p>
                    </div>
                </button>

                <!-- The Wealth Vault -->
                <button onclick="window.app.router.switchApp('wealth')" class="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95">
                    <div class="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[2rem] md:rounded-[2.5rem] shadow-xl group-hover:shadow-amber-500/20 flex items-center justify-center text-white text-4xl md:text-5xl transition-all relative overflow-hidden ring-4 ring-white dark:ring-slate-900 ring-offset-4 ring-offset-transparent">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <i class="fa-solid fa-vault drop-shadow-lg"></i>
                    </div>
                    <div class="text-center">
                        <h2 class="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">${t('apps.wealth.name') || 'Le Coffre-Fort'}</h2>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">${t('hub.tag_wealth') || 'Patrimoine'}</p>
                    </div>
                </button>

                <!-- Dashboard -->
                <button onclick="window.app.router.switchApp('dashboard')" class="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95">
                    <div class="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[2rem] md:rounded-[2.5rem] shadow-xl group-hover:shadow-emerald-500/20 flex items-center justify-center text-white text-4xl md:text-5xl transition-all relative overflow-hidden ring-4 ring-white dark:ring-slate-900 ring-offset-4 ring-offset-transparent">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <i class="fa-solid fa-gauge-high drop-shadow-lg"></i>
                    </div>
                    <div class="text-center">
                        <h2 class="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">${t('apps.dashboard.name') || 'Tableau de Bord'}</h2>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">${t('hub.tag_strategy') || 'Stratégie'}</p>
                    </div>
                </button>

                <!-- Philosophy & Guide -->
                <button onclick="window.app.router.switchApp('philosophy')" class="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95">
                    <div class="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-violet-500 to-violet-700 rounded-[2rem] md:rounded-[2.5rem] shadow-xl group-hover:shadow-violet-500/20 flex items-center justify-center text-white text-4xl md:text-5xl transition-all relative overflow-hidden ring-4 ring-white dark:ring-slate-900 ring-offset-4 ring-offset-transparent">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <i class="fa-solid fa-book-open drop-shadow-lg"></i>
                    </div>
                    <div class="text-center">
                        <h2 class="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">${t('apps.philosophy.name') || 'Philosophie & Guide'}</h2>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">${t('hub.tag_education') || 'Éducation'}</p>
                    </div>
                </button>
            </div>
        </div>
    `,
    render: () => {
        // Update Status Pill with current date
        const dateEl = document.getElementById('hub-status-date');
        if (dateEl) {
            const now = new Date();
            const month = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            dateEl.textContent = month.charAt(0).toUpperCase() + month.slice(1);
        }

        // Attach Backup Listener
        const backupBtn = document.getElementById('btn-backup-json-hub-ghost');
        if (backupBtn) {
            backupBtn.onclick = () => {
                if (window.app.exportFullBackupCSV) window.app.exportFullBackupCSV();
            };
        }

        // Attach Logout Listener
        const logoutBtn = document.getElementById('btn-logout-hub');
        if (logoutBtn) {
            logoutBtn.onclick = () => window.app.logout();
        }
    }
};
