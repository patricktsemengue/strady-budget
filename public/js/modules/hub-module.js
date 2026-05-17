import { t } from '../i18n.js';

export default {
    id: 'hub',
    hidden: true, // Don't show in regular nav
    appId: 'hub',
    getTemplate: () => `
        <div class="max-w-6xl mx-auto px-4 py-12 animate-fadeIn">
            <div class="text-center mb-16">
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
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Opérations</p>
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
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Patrimoine</p>
                    </div>
                </button>

                <!-- The Strategic Compass -->
                <button onclick="window.app.router.switchApp('compass')" class="group flex flex-col items-center gap-4 transition-all hover:scale-105 active:scale-95">
                    <div class="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[2rem] md:rounded-[2.5rem] shadow-xl group-hover:shadow-emerald-500/20 flex items-center justify-center text-white text-4xl md:text-5xl transition-all relative overflow-hidden ring-4 ring-white dark:ring-slate-900 ring-offset-4 ring-offset-transparent">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <i class="fa-solid fa-compass drop-shadow-lg"></i>
                    </div>
                    <div class="text-center">
                        <h2 class="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-widest">${t('apps.compass.name') || 'La Boussole'}</h2>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Stratégie</p>
                    </div>
                </button>
            </div>
            
            <!-- Quick Platform Tools -->
            <div class="mt-20 border-t border-slate-200 dark:border-slate-800 pt-12">
                <h3 class="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Outils Plateforme</h3>
                <div class="flex flex-wrap justify-center gap-4">
                    <button onclick="window.app.setView('settings')" class="flex items-center gap-3 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 transition-all">
                        <i class="fa-solid fa-gear"></i> Paramètres
                    </button>
                    <button id="btn-backup-json" class="flex items-center gap-3 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 transition-all">
                        <i class="fa-solid fa-download"></i> Sauvegarde Cloud
                    </button>
                </div>
            </div>
        </div>
    `,
    render: () => {
        // Any specific hub rendering logic
    }
};
