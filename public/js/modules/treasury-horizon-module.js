import { renderTreasuryHorizon } from '../treasury-horizon.js';
import { renderTimeline } from '../dashboard.js';
import { t } from '../i18n.js';

export default {
    id: 'horizon-soldes',
    get label() { return t('nav.horizon_soldes'); },
    get group() { return t('nav.groups.operations'); },
    icon: 'fa-chart-column',
    order: 4,
    showMonthSelection: true,
    getTemplate: () => `
        <div id="view-accounts" class="space-y-6 max-w-6xl mx-auto px-4 pb-24">
            <div class="flex flex-wrap justify-between items-end gap-4 mb-2">
                <div>
                    <h1 class="text-2xl font-black text-slate-800 tracking-tight">Trésorerie</h1>
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Projection multi-périodes des soldes (Grid Mode)</p>
                </div>
                
                <div class="flex items-center gap-2">
                    <button onclick="window.app.openTransferModal()" class="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest">
                        <i class="fa-solid fa-arrow-right-arrow-left text-indigo-500"></i> Virement
                    </button>
                    <button id="btn-add-account-horizon" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 flex items-center gap-2 shadow-md uppercase tracking-widest transition-all active:scale-95">
                        <i class="fa-solid fa-plus"></i> Nouveau compte
                    </button>
                </div>
            </div>

            <!-- Nature Filter Pills or Tools could be here -->
            <div class="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-fit ml-auto">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-table-list text-indigo-500 text-sm"></i>
                    <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Excel Mode</span>
                </div>
                <div class="w-px h-4 bg-slate-200"></div>
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-arrows-left-right text-slate-400 text-xs"></i>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scroll horizontal</span>
                </div>
            </div>
            
            <div id="treasury-horizon-container" class="relative">
                <div class="p-20 text-center text-slate-400 italic">Génération du tableau de trésorerie...</div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderTreasuryHorizon();
    },
    init: () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-add-account-horizon')) {
                import('../accounts.js').then(m => m.openAddAccountDrawer());
            }
        });
    }
};
