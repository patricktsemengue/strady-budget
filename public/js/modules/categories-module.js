import { renderCategoriesList } from '../categories.js';
import { t } from '../i18n.js';

export default {
    id: 'categories',
    get label() { return t('nav.categories'); },
    get group() { return t('nav.groups.config'); },
    icon: 'fa-tags',
    order: 1,
    showMonthSelection: false,
    getTemplate: () => `
        <div id="view-categories" class="space-y-6 max-w-6xl mx-auto px-4 pb-20">
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold text-slate-800">Analyses</h1>
                <button onclick="window.app.openAddCategoryDrawer()" class="hidden md:flex bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 items-center gap-2 shadow-md">
                    <i class="fa-solid fa-plus text-xs"></i> Nouveau poste
                </button>
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
