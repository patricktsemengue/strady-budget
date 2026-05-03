import { renderAccountsList } from '../accounts.js';
import { renderTimeline } from '../dashboard.js';
import { t } from '../i18n.js';

export default {
    id: 'accounts',
    accentColor: 'emerald',
    get label() { return t('nav.accounts'); },
    get group() { return t('nav.groups.operations'); },
    icon: 'fa-building-columns',
    order: 2,
    showMonthSelection: true,
    getHelpContent: () => ({
        title: t('help_cards.accounts.title'),
        purpose: t('help_cards.accounts.purpose'),
        actions: [
            { icon: "fa-university", label: t('help_cards.accounts.action1_label'), desc: t('help_cards.accounts.action1_desc') },
            { icon: "fa-arrows-rotate", label: t('help_cards.accounts.action2_label'), desc: t('help_cards.accounts.action2_desc') },
            { icon: "fa-right-left", label: t('help_cards.accounts.action3_label'), desc: t('help_cards.accounts.action3_desc') }
        ]
    }),
    getFabConfig: () => ({
        icon: 'fa-university',
        color: 'bg-emerald-600',
        action: () => window.app.openAddAccountDrawer()
    }),
    getTemplate: () => `
        <div id="view-accounts" class="space-y-6 max-w-6xl mx-auto px-4 pb-20">
            <!-- Sticky Header -->
            <div class="page-header-sticky">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <h1 class="text-2xl font-bold text-slate-800">${t('treasury.title')}</h1>
                        <button onclick="window.app.showHelp('accounts')" class="p-2 text-slate-300 hover:text-emerald-600 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-lg"></i>
                        </button>
                    </div>
                    <div class="flex gap-2">
                        <button id="btn-transfer-desktop" onclick="window.app.openTransferModal()" class="hidden md:flex bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all items-center gap-2 shadow-sm">
                            <i class="fa-solid fa-arrow-right-arrow-left text-indigo-500"></i> ${t('treasury.internal_transfer')}
                        </button>
                        <button id="btn-add-account-desktop" class="hidden md:flex bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 items-center shadow-md">
                            <i class="fa-solid fa-plus mr-2"></i> ${t('treasury.new_account')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Consolidated Summary -->
            <div id="treasury-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Summary cards injected by render -->
            </div>

            <!-- Table Header for Horizon (Desktop Only) -->
            <div class="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-y border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest items-center">
                <div class="col-span-4">${t('common.label')}</div>
                <div class="col-span-2 text-right">${t('transactions.col_var')}</div>
                <div class="col-span-2 text-right text-slate-900 font-black">${t('transactions.col_m0')}</div>
                <div class="col-span-2 text-right opacity-60">${t('transactions.col_m1')}</div>
                <div class="col-span-2 text-right opacity-40">${t('transactions.col_m2')}</div>
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
