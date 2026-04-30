import { renderTransactions, renderTimeline } from '../dashboard.js';
import { getMonthKey } from '../utils.js';
import { state } from '../state.js';
import { t } from '../i18n.js';

export default {
    id: 'transactions',
    accentColor: 'blue',
    get label() { return t('nav.transactions'); },
    get group() { return t('nav.groups.operations'); },
    icon: 'fa-list-check',
    order: 1,
    showMonthSelection: true,
    getHelpContent: () => ({
        title: t('help_cards.transactions.title'),
        purpose: t('help_cards.transactions.purpose'),
        actions: [
            { icon: "fa-plus-circle", label: t('help_cards.transactions.action1_label'), desc: t('help_cards.transactions.action1_desc') },
            { icon: "fa-filter", label: t('help_cards.transactions.action2_label'), desc: t('help_cards.transactions.action2_desc') },
            { icon: "fa-chart-pie", label: t('help_cards.transactions.action3_label'), desc: t('help_cards.transactions.action3_desc') }
        ]
    }),
    getFabConfig: () => {
        const monthKey = getMonthKey(state.viewDate);
        const isMonthClosed = state.records[monthKey]?.status === 'closed';
        if (isMonthClosed) return null;
        return {
            icon: 'fa-plus',
            color: 'bg-slate-800',
            action: () => window.app.openTransactionModal()
        };
    },
    getTemplate: () => `
        <div id="view-transactions" class="space-y-6 max-w-6xl mx-auto px-4 relative pb-24">
            <!-- Sticky Header -->
            <div class="page-header-sticky space-y-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <h1 class="text-2xl font-bold text-slate-800">${t('transactions.title')}</h1>
                        <button onclick="window.app.showHelp('transactions')" class="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-lg"></i>
                        </button>
                    </div>
                    <div class="hidden md:flex items-center gap-2">
                        <button id="btn-expand-all" class="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Tout développer">
                            <i class="fa-solid fa-layer-group"></i>
                        </button>
                        <button id="btn-collapse-all" class="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Tout réduire">
                            <i class="fa-solid fa-compress"></i>
                        </button>
                        <button id="btn-show-sankey" class="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title="Diagramme Sankey">
                            <i class="fa-solid fa-chart-pie"></i>
                        </button>
                    </div>
                </div>

                <!-- Nature Filter Pills (Inside Sticky) -->
                <div class="flex flex-wrap gap-2 overflow-x-auto pb-2 hide-scroll" id="nature-filters-sticky">
                    <button data-nature="ALL" onclick="window.app.setNatureFilter('ALL')" class="nature-pill ${localStorage.getItem('strady_nature_filter') === 'ALL' || !localStorage.getItem('strady_nature_filter') ? 'active bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'} px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">${t('nature.ALL') || 'TOUT'}</button>
                    <button data-nature="REVENU" onclick="window.app.setNatureFilter('REVENU')" class="nature-pill ${localStorage.getItem('strady_nature_filter') === 'REVENU' ? 'active bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'} px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">${t('nature.REVENU')}</button>
                    <button data-nature="FIXE" onclick="window.app.setNatureFilter('FIXE')" class="nature-pill ${localStorage.getItem('strady_nature_filter') === 'FIXE' ? 'active bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'} px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">${t('nature.FIXE')}</button>
                    <button data-nature="QUOTIDIEN" onclick="window.app.setNatureFilter('QUOTIDIEN')" class="nature-pill ${localStorage.getItem('strady_nature_filter') === 'QUOTIDIEN' ? 'active bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'} px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">${t('nature.QUOTIDIEN')}</button>
                    <button data-nature="LOISIR" onclick="window.app.setNatureFilter('LOISIR')" class="nature-pill ${localStorage.getItem('strady_nature_filter') === 'LOISIR' ? 'active bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'} px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">${t('nature.LOISIR')}</button>
                    <button data-nature="EPARGNE" onclick="window.app.setNatureFilter('EPARGNE')" class="nature-pill ${localStorage.getItem('strady_nature_filter') === 'EPARGNE' ? 'active bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500'} px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">${t('nature.EPARGNE')}</button>
                </div>
            </div>

            <!-- Desktop Stats Dashboard (Below sticky to allow scrolling) -->
            <div class="hidden md:grid grid-cols-3 gap-6">
                <!-- Inflows Card -->
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-emerald-200 transition-all">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-arrow-trend-up"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('transactions.inflows')}</p>
                        <p id="desktop-stats-in" class="text-2xl font-black text-slate-900">€0,00</p>
                    </div>
                </div>

                <!-- Outflows Card -->
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-rose-200 transition-all">
                    <div class="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-arrow-trend-down"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('transactions.outflows')}</p>
                        <p id="desktop-stats-out" class="text-2xl font-black text-slate-900">€0,00</p>
                    </div>
                </div>

                <!-- Net Card -->
                <div class="bg-indigo-600 rounded-2xl p-6 shadow-lg shadow-indigo-100 flex items-center gap-5 group hover:bg-indigo-700 transition-all">
                    <div class="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-2xl shadow-inner group-hover:rotate-12 transition-transform">
                        <i class="fa-solid fa-wallet"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">${t('transactions.monthly_net')}</p>
                        <p id="desktop-stats-net" class="text-2xl font-black text-white italic">€0,00</p>
                    </div>
                </div>
            </div>

            <!-- Monthly Transactions -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
                    <div class="flex items-center gap-4">
                        <h3 class="font-bold text-lg text-slate-800">${t('transactions.monthly_flows')}</h3>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Search Box -->
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <i class="fa-solid fa-magnifying-glass text-xs"></i>
                            </span>
                            <input type="text" id="search-transactions" placeholder="${t('transactions.search')}" class="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64 outline-none transition-all">
                        </div>

                        <!-- Desktop Filters -->
                        <div class="hidden md:flex items-center gap-2" id="transaction-list-filters">
                            <button id="btn-add-transaction-desktop" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 flex items-center shadow-md active:scale-95 transition-all">
                                <i class="fa-solid fa-plus mr-2"></i>${t('transactions.new_flow')}
                            </button>
                            
                            <div class="h-8 w-px bg-slate-200 mx-2"></div>

                            <select id="sort-order" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 outline-none hover:border-indigo-300 transition-all">
                                <option value="default" selected>${t('transactions.sort_default')}</option>
                                <option value="date-desc">${t('transactions.sort_date_desc')}</option>
                                <option value="account">${t('transactions.sort_account')}</option>
                                <option value="type">${t('transactions.sort_type')}</option>
                                <option value="amount-desc">${t('transactions.sort_amount_desc')}</option>
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
                            <!-- Header dynamically injected by renderTransactions() -->
                        </thead>
                        <tbody id="transactions-table-body" class="bg-white">
                            <!-- Rows Injected -->
                        </tbody>
                    </table>
                    <!-- Mobile Card View -->
                    <div id="transactions-container" class="md:hidden"></div>
                </div>
            </div>

            </div>
        </div>
    `,
    render: () => {
        // Show mobile net strip
        const mobileNetHeader = document.getElementById('mobile-net-header-strip');
        if (mobileNetHeader) mobileNetHeader.classList.remove('hidden');

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
            if (e.target.closest('#btn-close-filters-modal') || e.target.closest('#btn-close-filters-cancel')) {
                const modal = document.getElementById('mobile-filters-modal');
                if (modal) modal.classList.add('hidden');
            }
            if (e.target.closest('#btn-apply-filters')) {
                const modal = document.getElementById('mobile-filters-modal');
                if (modal) modal.classList.add('hidden');
                renderTransactions();
            }
            if (e.target.closest('#btn-expand-all')) {
                window.app.toggleAllCategoryGroups(true);
            }
            if (e.target.closest('#btn-collapse-all')) {
                window.app.toggleAllCategoryGroups(false);
            }
            if (e.target.closest('#btn-show-sankey')) {
                const modal = document.getElementById('sankey-modal');
                if (modal) modal.classList.remove('hidden');
                import('../dashboard.js').then(m => m.renderSankeyChart(true));
            }
            if (e.target.closest('#btn-close-sankey-modal')) {
                const modal = document.getElementById('sankey-modal');
                if (modal) modal.classList.add('hidden');
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
