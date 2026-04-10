import { renderTransactions, renderTimeline } from '../dashboard.js';
import { getMonthKey } from '../utils.js';
import { state } from '../state.js';

export default {
    id: 'transactions',
    label: 'Transactions',
    icon: 'fa-list-check',
    order: 2,
    showMonthSelection: true,
    showMobileFab: () => {
        const monthKey = getMonthKey(state.viewDate);
        const isMonthClosed = state.records[monthKey]?.status === 'closed';
        return !isMonthClosed;
    },
    getTemplate: () => `
        <div id="view-transactions" class="space-y-6 max-w-6xl mx-auto px-4">
            <h1 class="text-2xl font-bold text-slate-800">Transactions</h1>
            <!-- Monthly Transactions -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
                    <div class="flex items-center gap-4">
                        <h3 class="font-bold text-lg text-slate-800">Transactions du mois</h3>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Search Box -->
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <i class="fa-solid fa-magnifying-glass text-xs"></i>
                            </span>
                            <input type="text" id="search-transactions" placeholder="Rechercher..." class="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64">
                        </div>

                        <!-- Desktop Filters -->
                        <div class="hidden md:flex items-end gap-2" id="transaction-list-filters">
                            <button id="btn-add-transaction-desktop" class="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center mb-[1px]">
                                <i class="fa-solid fa-plus mr-2"></i>Ajouter
                            </button>
                            <div class="flex flex-col">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Catégories (Ctrl+clic)</label>
                                <select id="filter-category" multiple size="3" class="border-slate-300 rounded-lg shadow-sm border p-1 text-xs min-w-[150px] focus:ring-blue-500 focus:border-blue-500">
                                    <option value="all" selected>Toutes les catégories</option>
                                </select>
                            </div>
                            <div class="flex flex-col">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Comptes (Ctrl+clic)</label>
                                <select id="filter-account" multiple size="3" class="border-slate-300 rounded-lg shadow-sm border p-1 text-xs min-w-[150px] focus:ring-blue-500 focus:border-blue-500">
                                    <option value="all" selected>Tous les comptes</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-2 pl-2 border-l border-slate-200 h-10">
                                <label for="sort-order" class="text-sm font-medium text-slate-500 whitespace-nowrap">Trier :</label>
                                <select id="sort-order" class="border-slate-300 rounded-lg shadow-sm border p-2 text-sm font-medium text-slate-800">
                                    <option value="date-desc">Date (récent)</option>
                                    <option value="account">Compte</option>
                                    <option value="type">Type</option>
                                    <option value="category">Catégorie</option>
                                    <option value="amount-desc">Montant ↓</option>
                                    <option value="amount-asc">Montant ↑</option>
                                </select>
                            </div>
                        </div>
                        <!-- Mobile Kebab for Filters -->
                        <button id="btn-mobile-filters" class="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Filtres et tri">
                            <i class="fa-solid fa-filter"></i>
                        </button>
                    </div>
                </div>
                
                <div id="list-view-container" class="overflow-x-auto">
                    <!-- Desktop Table View -->
                    <table id="transactions-table" class="hidden md:table w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                                <th class="px-6 py-4 font-semibold">Date</th>
                                <th class="px-6 py-4 font-semibold">Type</th>
                                <th class="px-6 py-4 font-semibold">Catégorie</th>
                                <th class="px-6 py-4 font-semibold text-right">Montant</th>
                                <th class="px-6 py-4 font-semibold">Libellé</th>
                                <th class="px-6 py-4 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="transactions-table-body" class="divide-y divide-slate-100 bg-white">
                            <!-- Rows Injected -->
                        </tbody>
                    </table>
                    <!-- Mobile Card View -->
                    <ul id="transactions-container" class="md:hidden divide-y divide-slate-100"></ul>
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderTransactions();
    },
    init: () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-add-transaction-desktop')) {
                import('../transactions.js').then(m => m.openTransactionModal());
            }
            if (e.target.closest('#btn-mobile-filters')) {
                const modal = document.getElementById('mobile-filters-modal');
                if (modal) modal.classList.remove('hidden');
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'search-transactions') {
                renderTransactions();
            }
        });

        document.addEventListener('change', (e) => {
            if (['filter-category', 'filter-account', 'sort-order'].includes(e.target.id)) {
                renderTransactions();
            }
        });
    }
};
