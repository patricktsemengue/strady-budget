import { renderTransactions, renderTimeline } from '../dashboard.js';
import { getMonthKey } from '../utils.js';
import { state } from '../state.js';

export default {
    id: 'transactions',
    label: 'Flux & Prévisions',
    icon: 'fa-list-check',
    order: 2,
    showMonthSelection: true,
    showMobileFab: () => {
        const monthKey = getMonthKey(state.viewDate);
        const isMonthClosed = state.records[monthKey]?.status === 'closed';
        return !isMonthClosed;
    },
    getTemplate: () => `
        <div id="view-transactions" class="space-y-6 max-w-6xl mx-auto px-4 relative pb-24">
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold text-slate-800">Flux & Prévisions</h1>
                <div class="flex items-center gap-2">
                    <button id="btn-expand-all" class="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Tout développer">
                        <i class="fa-solid fa-layer-group"></i>
                    </button>
                    <button id="btn-collapse-all" class="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Tout réduire">
                        <i class="fa-solid fa-compress"></i>
                    </button>
                </div>
            </div>

            <!-- Nature Filter Pills -->
            <div class="flex flex-wrap gap-2 overflow-x-auto pb-2 hide-scroll" id="nature-filters">
                <button onclick="window.app.setNatureFilter('ALL')" class="nature-pill active bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">TOUT</button>
                <button onclick="window.app.setNatureFilter('REVENU')" class="nature-pill bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm">REVENUS</button>
                <button onclick="window.app.setNatureFilter('FIXE')" class="nature-pill bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all shadow-sm">CHARGES FIXES</button>
                <button onclick="window.app.setNatureFilter('QUOTIDIEN')" class="nature-pill bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm">VIE COURANTE</button>
                <button onclick="window.app.setNatureFilter('LOISIR')" class="nature-pill bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all shadow-sm">LOISIRS</button>
                <button onclick="window.app.setNatureFilter('EPARGNE')" class="nature-pill bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all shadow-sm">ÉPARGNE</button>
            </div>

            <!-- Monthly Transactions -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
                    <div class="flex items-center gap-4">
                        <h3 class="font-bold text-lg text-slate-800">Flux du mois</h3>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Search Box -->
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <i class="fa-solid fa-magnifying-glass text-xs"></i>
                            </span>
                            <input type="text" id="search-transactions" placeholder="Rechercher..." class="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64 outline-none transition-all">
                        </div>

                        <!-- Desktop Filters -->
                        <div class="hidden md:flex items-center gap-2" id="transaction-list-filters">
                            <button id="btn-add-transaction-desktop" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 flex items-center shadow-md active:scale-95 transition-all">
                                <i class="fa-solid fa-plus mr-2"></i>Nouveau flux
                            </button>
                            
                            <div class="h-8 w-px bg-slate-200 mx-2"></div>

                            <select id="sort-order" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 outline-none hover:border-indigo-300 transition-all">
                                <option value="default" selected>Défaut</option>
                                <option value="date-desc">Date (récent)</option>
                                <option value="account">Compte</option>
                                <option value="type">Type</option>
                                <option value="amount-desc">Montant ↓</option>
                            </select>
                        </div>
                        
                        <button id="btn-mobile-filters" class="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                            <i class="fa-solid fa-filter"></i>
                        </button>
                    </div>
                </div>
                
                <div id="list-view-container" class="overflow-x-auto min-h-[400px]">
                    <!-- Desktop Table View -->
                    <table id="transactions-table" class="hidden md:table w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th class="px-6 py-4">Date</th>
                                <th class="px-6 py-4">Type</th>
                                <th class="px-6 py-4 text-right">Montant</th>
                                <th class="px-6 py-4">Libellé / Comptes</th>
                                <th class="px-6 py-4 text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="transactions-table-body" class="bg-white">
                            <!-- Rows Injected -->
                        </tbody>
                    </table>
                    <!-- Mobile Card View -->
                    <div id="transactions-container" class="md:hidden"></div>
                </div>
            </div>

            <!-- Net Cash Flow Sticky Bar -->
            <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10 p-4 flex items-center justify-between px-8">
                <div class="flex items-center gap-6">
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Entrées</p>
                        <p id="net-bar-in" class="text-sm font-bold text-emerald-400">€0,00</p>
                    </div>
                    <div class="w-px h-8 bg-white/10"></div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sorties</p>
                        <p id="net-bar-out" class="text-sm font-bold text-rose-400">€0,00</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Net du Mois</p>
                    <p id="net-bar-total" class="text-lg font-black italic">€0,00</p>
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
            if (e.target.closest('#btn-expand-all')) {
                window.app.toggleAllCategoryGroups(true);
            }
            if (e.target.closest('#btn-collapse-all')) {
                window.app.toggleAllCategoryGroups(false);
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
