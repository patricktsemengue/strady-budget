import { renderCategoriesList } from '../categories.js';
import { t } from '../i18n.js';

export default {
    id: 'categories',
    accentColor: 'amber',
    get label() { return t('nav.categories'); },
    get group() { return t('nav.groups.config'); },
    icon: 'fa-tags',
    order: 1,
    showMonthSelection: false,
    getHelpContent: () => ({
        title: t('help_cards.categories.title'),
        purpose: t('help_cards.categories.purpose'),
        actions: [
            { icon: "fa-tags", label: t('help_cards.categories.action1_label'), desc: t('help_cards.categories.action1_desc') },
            { icon: "fa-leaf", label: t('help_cards.categories.action2_label'), desc: t('help_cards.categories.action2_desc') },
            { icon: "fa-arrow-down-up-across-line", label: t('help_cards.categories.action3_label'), desc: t('help_cards.categories.action3_desc') }
        ]
    }),
    getFabConfig: () => ({
        icon: 'fa-tag',
        color: 'bg-amber-600',
        action: () => window.app.openAddCategoryDrawer()
    }),
    getTemplate: () => `
        <div id="view-categories" class="space-y-6 max-w-6xl mx-auto px-4 pb-20">
            <!-- Sticky Header -->
            <div class="page-header-sticky">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <h1 class="text-2xl font-bold text-slate-800">Analyses</h1>
                        <button onclick="window.app.showHelp('categories')" class="p-2 text-slate-300 hover:text-amber-600 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-lg"></i>
                        </button>
                    </div>
                    <button onclick="window.app.openAddCategoryDrawer()" class="hidden md:flex bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 flex items-center gap-2 shadow-md uppercase tracking-widest transition-all active:scale-95">
                        <i class="fa-solid fa-plus text-xs"></i> Nouveau poste
                    </button>
                </div>
            </div>

            <!-- Categories List Grouped by Nature -->
            <div id="mgmt-categories-list" class="space-y-2">
                <div class="p-20 text-center text-slate-400 italic">Chargement des postes d'analyse...</div>
            </div>
        </div>
    `,
    render: () => {
        import('../categories.js').then(m => m.renderCategoriesList());
    },
    init: () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-add-category-desktop')) {
                import('../categories.js').then(m => m.openAddCategoryDrawer());
            }
        });
    }
};
