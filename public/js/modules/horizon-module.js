import { renderHorizon, toggleHorizonCategory } from '../horizon.js';
import { renderTimeline, populateCategoryFilter, populateAccountFilter } from '../dashboard.js';

export default {
    id: 'transactions',
    label: 'Flux & Prévisions',
    group: 'PILOTAGE OPÉRATIONNEL',
    icon: 'fa-columns',
    order: 3,
    showMonthSelection: true,
    getTemplate: () => `
        <div id="view-transactions" class="space-y-6 max-w-6xl mx-auto px-4 pb-24">
            <div class="flex flex-wrap justify-between items-end gap-4 mb-2">
                <div>
                    <h1 class="text-2xl font-black text-slate-800 tracking-tight">Flux & Prévisions</h1>
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Analyse comparative multi-périodes (Grid Mode)</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-2">
                    <button id="btn-horizon-expand-all" class="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Tout développer">
                        <i class="fa-solid fa-layer-group"></i>
                    </button>
                    <button id="btn-horizon-collapse-all" class="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Tout réduire">
                        <i class="fa-solid fa-compress"></i>
                    </button>
                    
                    <div class="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    <!-- Filters -->
                    <select id="filter-category-horizon" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none hover:border-indigo-300 transition-all shadow-sm">
                        <option value="all">Toutes les catégories</option>
                    </select>
                    <select id="filter-account-horizon" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none hover:border-indigo-300 transition-all shadow-sm">
                        <option value="all">Tous les comptes</option>
                    </select>

                    <div class="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    <div class="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-table-cells text-indigo-500 text-sm"></i>
                            <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Excel Mode</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Nature Filter Pills -->
            <div class="flex flex-wrap gap-2 overflow-x-auto pb-2 hide-scroll" id="nature-filters-horizon">
                <button onclick="window.app.setHorizonNatureFilter('ALL')" class="nature-pill-horizon active bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">TOUT</button>
                <button onclick="window.app.setHorizonNatureFilter('REVENU')" class="nature-pill-horizon bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm">REVENUS</button>
                <button onclick="window.app.setHorizonNatureFilter('FIXE')" class="nature-pill-horizon bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all shadow-sm">CHARGES FIXES</button>
                <button onclick="window.app.setHorizonNatureFilter('QUOTIDIEN')" class="nature-pill-horizon bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm">VIE COURANTE</button>
                <button onclick="window.app.setHorizonNatureFilter('LOISIR')" class="nature-pill-horizon bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all shadow-sm">LOISIRS</button>
                <button onclick="window.app.setHorizonNatureFilter('EPARGNE')" class="nature-pill-horizon bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all shadow-sm">ÉPARGNE</button>
            </div>

            <div id="horizon-view-container" class="relative">
                <div class="p-20 text-center text-slate-400 italic">Génération du tableau comparatif...</div>
            </div>

            <!-- Multi-Month Net Cash Flow Sticky Bar -->
            <div id="horizon-net-sticky-bar" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-5xl bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10 p-4 hidden overflow-x-auto hide-scroll">
                <div class="flex items-center justify-around gap-8 min-w-max px-4" id="horizon-net-bar-content">
                    <!-- Monthly totals injected here -->
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        
        // Custom population for horizon filters since they have unique IDs
        const catSelect = document.getElementById('filter-category-horizon');
        const accSelect = document.getElementById('filter-account-horizon');
        
        if (catSelect) {
            import('../dashboard.js').then(m => {
                // Temporary hijack of populate functions or manual population
                const originalCat = document.getElementById('filter-category');
                const originalAcc = document.getElementById('filter-account');
                
                // We manually populate to avoid ID conflicts with the standard dashboard
                import('../state.js').then(stateMod => {
                    const state = stateMod.state;
                    catSelect.innerHTML = '<option value="all">Toutes les catégories</option>';
                    state.categories.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = c.label;
                        catSelect.appendChild(opt);
                    });
                    
                    accSelect.innerHTML = '<option value="all">Tous les comptes</option>';
                    state.accounts.forEach(a => {
                        const opt = document.createElement('option');
                        opt.value = a.id;
                        opt.textContent = a.name;
                        accSelect.appendChild(opt);
                    });
                });
            });
        }

        renderHorizon();
    },
    init: () => {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-horizon-expand-all')) {
                import('../horizon.js').then(m => m.toggleAllHorizonCategories(true));
            }
            if (e.target.closest('#btn-horizon-collapse-all')) {
                import('../horizon.js').then(m => m.toggleAllHorizonCategories(false));
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'filter-category-horizon' || e.target.id === 'filter-account-horizon') {
                renderHorizon();
            }
        });

        // Expose toggle function to global app
        window.app.toggleHorizonCategory = toggleHorizonCategory;
        window.app.setHorizonNatureFilter = (nature) => import('../horizon.js').then(m => m.setHorizonNatureFilter(nature));
    }
};
