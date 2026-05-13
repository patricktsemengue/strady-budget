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

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- The Daily Ledger -->
                <button onclick="window.app.router.switchApp('ledger')" class="group relative bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all text-left overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                    <div class="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-lg group-hover:rotate-12 transition-transform">
                        <i class="fa-solid fa-list-check"></i>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-3">${t('apps.ledger.name') || 'Le Grand Livre'}</h2>
                    <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                        ${t('apps.ledger.desc') || 'Suivi quotidien de vos revenus et dépenses. Gérez vos comptes et catégories en temps réel.'}
                    </p>
                    <div class="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                        Lancer l'App <i class="fa-solid fa-arrow-right group-hover:translate-x-2 transition-transform"></i>
                    </div>
                </button>

                <!-- The Wealth Vault -->
                <button onclick="window.app.router.switchApp('wealth')" class="group relative bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all text-left overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/20 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                    <div class="w-16 h-16 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-lg group-hover:rotate-12 transition-transform">
                        <i class="fa-solid fa-vault"></i>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-3">${t('apps.wealth.name') || 'Le Coffre-Fort'}</h2>
                    <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                        ${t('apps.wealth.desc') || 'Visualisez votre patrimoine net. Suivez vos actifs, dettes et l\'évolution de votre richesse.'}
                    </p>
                    <div class="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-widest">
                        Lancer l'App <i class="fa-solid fa-arrow-right group-hover:translate-x-2 transition-transform"></i>
                    </div>
                </button>

                <!-- The Strategic Compass -->
                <button onclick="window.app.router.switchApp('compass')" class="group relative bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all text-left overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                    <div class="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-lg group-hover:rotate-12 transition-transform">
                        <i class="fa-solid fa-compass"></i>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-3">${t('apps.compass.name') || 'La Boussole'}</h2>
                    <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                        ${t('apps.compass.desc') || 'Analysez vos habitudes et optimisez votre stratégie financière avec la méthode 70/20/10.'}
                    </p>
                    <div class="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                        Lancer l'App <i class="fa-solid fa-arrow-right group-hover:translate-x-2 transition-transform"></i>
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
