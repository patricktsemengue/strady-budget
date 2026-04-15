import { renderMonthSelectorConfig } from '../settings.js';

export default {
    id: 'settings',
    label: 'Réglages',
    icon: 'fa-cog',
    order: 5,
    showMonthSelection: false,
    getTemplate: () => `
        <div id="view-settings" class="space-y-8 max-w-6xl mx-auto px-4">
            <h1 class="text-2xl font-bold text-slate-800">Réglages</h1>

            <!-- Month Selector Configuration -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h3 class="font-bold text-lg text-slate-800 mb-4">Sélecteur de Période</h3>
                <form id="month-selector-config-form" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Date de début</label>
                        <input type="date" id="config-month-start" required class="w-full border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Date de fin</label>
                        <input type="date" id="config-month-end" required class="w-full border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                    </div>
                    <div class="md:col-span-2 flex justify-end">
                        <button type="submit" class="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors shadow-md">
                            Enregistrer la configuration
                        </button>
                    </div>
                </form>
            </div>

            <!-- Universal Backup System -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 class="font-bold text-lg text-slate-800">Sauvegarde & Restauration</h3>
                        <p class="text-sm text-slate-500">Gérez l'intégralité de vos données Strady dans un seul fichier.</p>
                    </div>
                    <button id="btn-export-full-backup" class="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm">
                        <i class="fa-solid fa-download"></i> Exporter ma sauvegarde complète
                    </button>
                </div>
                
                <div class="p-8">
                    <div id="import-dropzone" class="relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-2xl p-10 transition-all hover:border-blue-400 hover:bg-blue-50/30 flex flex-col items-center justify-center text-center">
                        <input type="file" id="full-backup-import-input" class="absolute inset-0 opacity-0 cursor-pointer" accept=".csv">
                        
                        <div class="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-cloud-arrow-up text-2xl"></i>
                        </div>
                        
                        <div class="space-y-1">
                            <h4 class="font-bold text-slate-800">Importer une sauvegarde</h4>
                            <p class="text-sm text-slate-500 max-w-sm">Glissez-déposez votre fichier CSV ici ou cliquez pour parcourir vos dossiers.</p>
                        </div>

                        <div class="mt-4 flex gap-2 flex-wrap justify-center">
                            <span class="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Format Universel .csv</span>
                            <span class="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Comptes</span>
                            <span class="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Transactions</span>
                            <span class="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Catégories</span>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <i class="fa-solid fa-circle-info text-amber-500 mt-0.5"></i>
                        <div class="text-xs text-amber-800 leading-relaxed">
                            <strong class="block mb-1">Note sur l'importation :</strong>
                            L'importation détecte automatiquement les doublons. Si vous importez des données déjà présentes, le système vous proposera de les ignorer pour éviter les répétitions. Les comptes et catégories inexistants seront créés automatiquement.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Danger Zone -->
            <div class="mt-8 p-6 border-2 border-red-100 rounded-2xl bg-red-50/30">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <h3 class="font-bold text-xl text-red-900">Zone de Danger</h3>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Path A: Restoration (Starter Pack) -->
                    <div class="bg-white p-5 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-arrow-rotate-left text-lg"></i>
                            </div>
                            <h5 class="font-bold text-slate-800">Restaurer le Starter Pack</h5>
                        </div>
                        <p class="text-xs text-slate-500 mb-6 flex-grow">Supprime vos données actuelles et réinstalle les comptes, catégories et transactions recommandés pour repartir sur une base saine.</p>
                        <button id="btn-factory-reset-starter" class="w-full py-2.5 px-4 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-600 hover:text-white transition-all border border-blue-200">
                            Réinstaller le Starter Pack
                        </button>
                    </div>

                    <!-- Path B: Destruction (Clean Slate) -->
                    <div class="bg-white p-5 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-eraser text-lg"></i>
                            </div>
                            <h5 class="font-bold text-slate-800">Effacement Total</h5>
                        </div>
                        <p class="text-xs text-slate-500 mb-6 flex-grow">Supprime DEFINITIVEMENT tout votre espace (Comptes, Transactions, Catégories). Vous recommencerez avec une application vide.</p>
                        <button id="btn-factory-reset-wipe" class="w-full py-2.5 px-4 bg-red-50 text-red-700 rounded-lg text-sm font-bold hover:bg-red-600 hover:text-white transition-all border border-red-200">
                            Tout vider (Page Blanche)
                        </button>
                    </div>
                </div>

                <div class="mt-6 pt-6 border-t border-red-100 flex justify-end">
                    <button id="btn-logout-settings" class="bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-md flex items-center gap-2">
                        <i class="fa-solid fa-right-from-bracket"></i> Déconnexion de Strady
                    </button>
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderMonthSelectorConfig();
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
                    if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
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
        const dropzone = document.getElementById('import-dropzone');
        if (dropzone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => dropzone.classList.add('border-blue-400', 'bg-blue-50/30'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-blue-400', 'bg-blue-50/30'), false);
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
    }
};
