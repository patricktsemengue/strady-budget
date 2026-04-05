import { renderCategoriesList } from '../categories.js';

export default {
    id: 'categories',
    label: 'Catégories',
    icon: 'fa-tags',
    order: 4,
    showMonthSelection: false,
    getTemplate: () => `
        <div id="view-categories" class="space-y-6 max-w-6xl mx-auto px-4">
            <h1 class="text-2xl font-bold text-slate-800">Catégories</h1>
            <!-- Categories CRUD -->
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 class="font-bold text-lg text-slate-800">Gérer les catégories</h3>
                    <button id="btn-add-category-desktop" class="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-plus text-xs"></i> Ajouter
                    </button>
                </div>
                <div class="p-0 md:p-5">
                    <!-- Desktop Table View -->
                    <table class="hidden md:table w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                                <th class="px-6 py-4 font-semibold w-12"></th>
                                <th class="px-6 py-4 font-semibold">Icône</th>
                                <th class="px-6 py-4 font-semibold">Libellé</th>
                                <th class="px-6 py-4 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="mgmt-categories-table-body" class="divide-y divide-slate-100 bg-white">
                            <!-- Rows Injected -->
                        </tbody>
                    </table>
                    <!-- Mobile Card View -->
                    <ul id="mgmt-categories-list" class="md:hidden divide-y divide-slate-100"></ul>
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderCategoriesList();
    },
    init: () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-add-category-desktop')) {
                import('../categories.js').then(m => m.openAddCategoryDrawer());
            }
        });
    }
};
