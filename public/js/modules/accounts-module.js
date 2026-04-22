import { renderAccountsList } from '../accounts.js';
import { renderTimeline } from '../dashboard.js';

export default {
    id: 'accounts',
    label: 'Trésorerie',
    icon: 'fa-building-columns',
    order: 3,
    showMonthSelection: true,
    getTemplate: () => `
        <div id="view-accounts" class="space-y-6 max-w-6xl mx-auto px-4 pb-20">
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold text-slate-800">Trésorerie</h1>
                <div class="flex gap-2">
                    <button onclick="window.app.openTransferModal()" class="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                        <i class="fa-solid fa-arrow-right-arrow-left text-indigo-500"></i> Virement interne
                    </button>
                    <button id="btn-add-account-desktop" class="hidden md:flex bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 items-center shadow-md">
                        <i class="fa-solid fa-plus mr-2"></i> Nouveau compte
                    </button>
                </div>
            </div>

            <!-- Consolidated Summary -->
            <div id="treasury-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Summary cards injected by render -->
            </div>

            <!-- Accounts List Grouped by Nature -->
            <div id="mgmt-accounts-list" class="space-y-8">
                <div class="p-20 text-center text-slate-400 italic">Chargement de votre trésorerie...</div>
            </div>
        </div>
    `,
    render: () => {
        import('../accounts.js').then(m => m.renderAccountsList());
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
