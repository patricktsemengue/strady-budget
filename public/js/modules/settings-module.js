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
                <form id="month-selector-config-form" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Date de début</label>
                        <input type="date" id="config-month-start" required class="w-full border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Date de fin</label>
                        <input type="date" id="config-month-end" required class="w-full border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Pas (Étape)</label>
                        <select id="config-month-step" class="w-full border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                            <option value="month">Mensuel</option>
                            <option value="quarter">Trimestriel</option>
                        </select>
                    </div>
                    <div class="md:col-span-3 flex justify-end">
                        <button type="submit" class="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors shadow-md">
                            Enregistrer la configuration
                        </button>
                    </div>
                </form>
            </div>

            <!-- Data Management -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h3 class="font-bold text-lg text-slate-800 mb-4">Données</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <h4 class="font-bold text-slate-700 mb-2">Transactions</h4>
                        <div class="flex gap-2">
                            <button id="export-transactions-csv" class="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded text-sm hover:bg-slate-100"><i class="fa-solid fa-download mr-1"></i> Exporter CSV</button>
                            <button id="import-transactions-csv" class="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded text-sm hover:bg-slate-100"><i class="fa-solid fa-upload mr-1"></i> Importer CSV</button>
                            <input type="file" id="csv-import-input" class="hidden" accept=".csv">
                        </div>
                    </div>
                    <div class="p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <h4 class="font-bold text-slate-700 mb-2">Comptes</h4>
                        <div class="flex gap-2">
                            <button id="export-accounts-csv" class="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded text-sm hover:bg-slate-100"><i class="fa-solid fa-download mr-1"></i> Exporter CSV</button>
                            <button id="import-accounts-csv" class="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded text-sm hover:bg-slate-100"><i class="fa-solid fa-upload mr-1"></i> Importer CSV</button>
                            <input type="file" id="csv-import-acc-input" class="hidden" accept=".csv">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Danger Zone -->
            <div class="mt-8 p-4 border border-red-200 rounded-lg bg-red-50">
                <h4 class="font-bold text-red-800 mb-2">Zone de Danger</h4>
                <div class="flex items-center gap-4 mb-4">
                    <div class="flex items-center">
                        <input type="checkbox" id="delete-transactions-checkbox" class="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500">
                        <label for="delete-transactions-checkbox" class="ml-2 block text-sm text-gray-900">Supprimer les transactions</label>
                    </div>
                    <div class="flex items-center">
                        <input type="checkbox" id="delete-accounts-checkbox" class="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500">
                        <label for="delete-accounts-checkbox" class="ml-2 block text-sm text-gray-900">Supprimer les comptes et les transactions</label>
                    </div>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button id="reset-button" class="bg-white border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2">
                        <i class="fa-solid fa-triangle-exclamation"></i> Réinitialiser les données
                    </button>
                    <button id="btn-logout-settings" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2">
                        <i class="fa-solid fa-right-from-bracket"></i> Déconnexion
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
            if (e.target.id === 'export-transactions-csv') {
                import('../data.js').then(m => m.exportCSV());
            }
            if (e.target.id === 'import-transactions-csv') {
                document.getElementById('csv-import-input').click();
            }
            if (e.target.id === 'export-accounts-csv') {
                import('../data.js').then(m => m.exportAccountsCSV());
            }
            if (e.target.id === 'import-accounts-csv') {
                document.getElementById('csv-import-acc-input').click();
            }
            if (e.target.id === 'reset-button') {
                import('../data.js').then(m => m.handleReset());
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
            if (e.target.id === 'csv-import-input') {
                import('../data.js').then(m => m.importCSV(e));
            }
            if (e.target.id === 'csv-import-acc-input') {
                import('../data.js').then(m => m.importAccountsCSV(e));
            }
        });
    }
};
