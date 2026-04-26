import { t, getCurrentLanguage } from '../i18n.js';

export default {
    id: 'settings',
    get label() { return t('nav.settings'); },
    get group() { return t('nav.groups.config'); },
    icon: 'fa-cog',
    order: 10,
    showMonthSelection: false,
    getHelpContent: () => ({
        title: t('help_cards.settings.title'),
        purpose: t('help_cards.settings.purpose'),
        actions: [
            { icon: "fa-calendar-days", label: t('help_cards.settings.action1_label'), desc: t('help_cards.settings.action1_desc') },
            { icon: "fa-vault", label: t('help_cards.settings.action2_label'), desc: t('help_cards.settings.action2_desc') },
            { icon: "fa-language", label: t('help_cards.settings.action3_label'), desc: t('help_cards.settings.action3_desc') }
        ]
    }),
    getFabConfig: () => null,
    getTemplate: () => `
        <div id="view-settings" class="space-y-8 max-w-6xl mx-auto px-4 pb-20">
            <h1 class="text-2xl font-bold text-slate-800">${t('settings.title')}</h1>

            <!-- 1. Horizon de Pilotage -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-50 bg-slate-50/50">
                    <h3 class="font-bold text-lg text-slate-800">${t('settings.horizon.title')}</h3>
                    <p class="text-sm text-slate-500">${t('settings.horizon.subtitle')}</p>
                </div>
                <div class="p-6 space-y-6">
                    <div class="flex flex-wrap gap-3">
                        <button onclick="window.app.setSettingPreset('cfo')" class="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100">${t('settings.horizon.preset_cfo')}</button>
                        <button onclick="window.app.setSettingPreset('history')" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">${t('settings.horizon.preset_history')}</button>
                        <button onclick="window.app.setSettingPreset('year')" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">${t('settings.horizon.preset_year')}</button>
                    </div>
                    
                    <form id="month-selector-config-form" class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                        <div>
                            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">${t('settings.horizon.start_date')}</label>
                            <input type="date" id="config-month-start" required class="w-full border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                        </div>
                        <div>
                            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">${t('settings.horizon.end_date')}</label>
                            <input type="date" id="config-month-end" required class="w-full border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                        </div>
                        <div class="md:col-span-2 flex justify-end">
                            <button type="submit" class="bg-slate-800 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-lg active:scale-95">
                                ${t('settings.horizon.save')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 2. Paramètres Stratégiques -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-50 bg-slate-50/50">
                    <h3 class="font-bold text-lg text-slate-800">${t('settings.strategy.title')}</h3>
                    <p class="text-sm text-slate-500">${t('settings.strategy.subtitle')}</p>
                </div>
                <div class="p-6">
                    <div class="max-w-md">
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">${t('settings.strategy.ef_goal')}</label>
                        <div class="flex items-center gap-4 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                            <button onclick="window.app.updateEFMultiplier(3)" id="btn-ef-3" class="flex-1 py-3 rounded-xl text-sm font-bold transition-all">3 mois</button>
                            <button onclick="window.app.updateEFMultiplier(6)" id="btn-ef-6" class="flex-1 py-3 rounded-xl text-sm font-bold transition-all">6 mois</button>
                            <button onclick="window.app.updateEFMultiplier(12)" id="btn-ef-12" class="flex-1 py-3 rounded-xl text-sm font-bold transition-all">12 mois</button>
                        </div>
                        <p class="text-[11px] text-slate-400 mt-4 leading-relaxed italic">
                            ${t('settings.strategy.ef_help')}
                        </p>
                    </div>
                </div>
            </div>

            <!-- 3. Le Coffre-Fort (Sauvegarde) -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 class="font-bold text-lg text-slate-800">${t('settings.vault.title')}</h3>
                        <p class="text-sm text-slate-500">${t('settings.vault.subtitle')}</p>
                    </div>
                    <div class="flex gap-2">
                        <button id="btn-export-full-backup" class="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                            <i class="fa-solid fa-download text-indigo-500"></i> ${t('settings.vault.backup')}
                        </button>
                        <button onclick="document.getElementById('import-zone-wrapper').classList.toggle('hidden')" class="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                            <i class="fa-solid fa-upload text-blue-500"></i> ${t('settings.vault.restore')}
                        </button>
                    </div>
                </div>
                
                <div id="import-zone-wrapper" class="p-8 hidden border-t border-slate-50 bg-blue-50/20">
                    <div id="import-dropzone" class="relative group cursor-pointer border-2 border-dashed border-blue-200 rounded-3xl p-12 transition-all hover:border-blue-400 hover:bg-white flex flex-col items-center justify-center text-center shadow-inner">
                        <input type="file" id="full-backup-import-input" class="absolute inset-0 opacity-0 cursor-pointer" accept=".csv">
                        <div class="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                            <i class="fa-solid fa-cloud-arrow-up text-3xl"></i>
                        </div>
                        <div class="space-y-2">
                            <h4 class="font-bold text-slate-800 text-lg">${t('settings.vault.import_dropzone')}</h4>
                            <p class="text-sm text-slate-500 max-w-sm mx-auto italic">${t('settings.vault.import_help')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. Maintenance & Danger Zone -->
            <div class="rounded-2xl border border-rose-100 bg-rose-50/30 overflow-hidden">
                <button onclick="document.getElementById('danger-zone-content').classList.toggle('hidden')" class="w-full p-6 flex items-center justify-between hover:bg-rose-50/50 transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-screwdriver-wrench"></i>
                        </div>
                        <div class="text-left">
                            <h3 class="font-bold text-rose-900">${t('settings.maintenance.title')}</h3>
                            <p class="text-xs text-rose-700 opacity-70">${t('settings.maintenance.subtitle')}</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down text-rose-300"></i>
                </button>

                <div id="danger-zone-content" class="hidden p-6 pt-0 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-white p-5 rounded-2xl border border-rose-50 shadow-sm flex flex-col">
                            <h5 class="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <i class="fa-solid fa-arrow-rotate-left text-blue-500"></i>
                                ${t('settings.maintenance.reset_starter')}
                            </h5>
                            <p class="text-[11px] text-slate-500 mb-6 flex-grow leading-relaxed">${t('settings.maintenance.reset_starter_help')}</p>
                            <button id="btn-factory-reset-starter" class="w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-slate-100">${t('settings.maintenance.reset_button')}</button>
                        </div>
                        <div class="bg-white p-5 rounded-2xl border border-rose-50 shadow-sm flex flex-col">
                            <h5 class="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <i class="fa-solid fa-eraser text-rose-500"></i>
                                ${t('settings.maintenance.reset_wipe')}
                            </h5>
                            <p class="text-[11px] text-slate-500 mb-6 flex-grow leading-relaxed">${t('settings.maintenance.reset_wipe_help')}</p>
                            <button id="btn-factory-reset-wipe" class="w-full py-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-100">${t('settings.maintenance.wipe_button')}</button>
                        </div>
                    </div>
                    <div class="pt-6 border-t border-rose-100 flex justify-end">
                        <button id="btn-logout-settings" class="bg-rose-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                            <i class="fa-solid fa-right-from-bracket"></i> ${t('settings.maintenance.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    render: () => {
        import('../settings.js').then(m => m.renderSettings());
    },
    init: () => {
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'month-selector-config-form') {
                import('../settings.js').then(m => m.handleSaveMonthSelectorConfig(e));
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-export-full-backup' || e.target.closest('#btn-export-full-backup')) {
                import('../data.js').then(m => m.exportFullBackupCSV());
            }
            if (e.target.id === 'btn-factory-reset-starter') {
                import('../data.js').then(m => m.handleFactoryReset('starter'));
            }
            if (e.target.id === 'btn-factory-reset-wipe') {
                import('../data.js').then(m => m.handleFactoryReset('scratch'));
            }
            if (e.target.id === 'btn-logout-settings') {
                import('../auth.js').then(m => {
                    if (confirm(t('confirm.logout'))) {
                        m.logout();
                    }
                });
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'full-backup-import-input') {
                import('../data.js').then(m => m.importFullBackupCSV(e));
            }
        });

        // Dropzone drag & drop logic
        const initDropzone = () => {
            const dropzone = document.getElementById('import-dropzone');
            if (dropzone) {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    dropzone.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }, false);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    dropzone.addEventListener(eventName, () => dropzone.classList.add('border-blue-400', 'bg-white'), false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-blue-400', 'bg-white'), false);
                });

                dropzone.addEventListener('drop', (e) => {
                    const dt = e.dataTransfer;
                    const files = dt.files;
                    if (files.length > 0) {
                        const input = document.getElementById('full-backup-import-input');
                        input.files = files;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, false);
            }
        };

        // Mutation observer to handle dynamic rendering of dropzone if hidden
        const observer = new MutationObserver((mutations) => {
            if (document.getElementById('import-dropzone')) {
                initDropzone();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
};
