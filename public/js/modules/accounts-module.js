import { renderAccountsList } from '../accounts.js';
import { renderTimeline } from '../dashboard.js';

export default {
    id: 'accounts',
    label: 'Comptes',
    icon: 'fa-building-columns',
    order: 3,
    showMonthSelection: true,
    getTemplate: () => `
        <div id="view-accounts" class="space-y-6 max-w-6xl mx-auto px-4">
            <h1 class="text-2xl font-bold text-slate-800">Comptes</h1>
            <!-- Accounts CRUD -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
                    <h3 class="font-bold text-lg text-slate-800">Gérer les comptes</h3>
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Search Box -->
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <i class="fa-solid fa-magnifying-glass text-xs"></i>
                            </span>
                            <input type="text" id="search-accounts" placeholder="Rechercher..." class="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64">
                        </div>

                        <select id="filter-account-type" class="border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                            <option value="all">Tous les types</option>
                            <option value="current">Courant</option>
                            <option value="savings">Épargne</option>
                            <option value="investment">Investissement</option>
                        </select>

                        <select id="sort-accounts" class="border-slate-300 rounded-lg shadow-sm border p-2 text-sm">
                            <option value="name-asc">Nom (A-Z)</option>
                            <option value="type">Type</option>
                            <option value="balance-desc">Solde ↓</option>
                            <option value="balance-asc">Solde ↑</option>
                        </select>

                        <button id="btn-add-account-desktop" class="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center gap-2">
                            <i class="fa-solid fa-plus text-xs"></i> Ajouter
                        </button>
                    </div>
                </div>
                <div class="p-0 md:p-5">
                    <!-- Desktop Table View -->
                    <table class="hidden md:table w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                                <th class="px-6 py-4 font-semibold">Libellé</th>
                                <th class="px-6 py-4 font-semibold">Tag</th>
                                <th class="px-6 py-4 font-semibold text-right">Solde</th>
                                <th class="px-6 py-4 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="mgmt-accounts-table-body" class="divide-y divide-slate-100 bg-white">
                            <!-- Rows Injected -->
                        </tbody>
                    </table>
                    <!-- Mobile Card View -->
                    <ul id="mgmt-accounts-list" class="md:hidden divide-y divide-slate-100"></ul>
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderAccountsList();
    },
    init: () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-add-account-desktop')) {
                import('../accounts.js').then(m => m.openAddAccountDrawer());
            }
        });
        document.addEventListener('input', (e) => {
            if (e.target.id === 'search-accounts') {
                renderAccountsList();
            }
        });
        document.addEventListener('change', (e) => {
            if (['filter-account-type', 'sort-accounts'].includes(e.target.id)) {
                renderAccountsList();
            }
        });
    }
};
