import { renderDashboard } from '../dashboard.js';

export default {
    id: 'pilotage-legacy',
    label: 'Pilotage (Ancien)',
    icon: 'fa-chart-line',
    order: 8,
    showMonthSelection: true,
    getTemplate: () => `
        <div id="view-pilotage-legacy" class="space-y-6 max-w-6xl mx-auto px-4">
            <h1 class="text-2xl font-bold text-slate-800">Pilotage (Ancien)</h1>

            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patrimoine Net</p>
                    <div id="dash-net-worth">--</div>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Liquidité Globale</p>
                    <h2 class="text-2xl font-black text-slate-800" id="dash-total-balance">--</h2>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenus</p>
                    <h2 class="text-2xl font-bold text-success" id="dash-month-income">--</h2>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dépenses</p>
                    <h2 class="text-2xl font-bold text-danger" id="dash-month-expense">--</h2>
                    <p id="dash-month-diff" class="text-[10px] font-medium mt-1"></p>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fond d'urgence</p>
                    <div id="dash-emergency-fund">--</div>
                </div>
            </div>

            <!-- Anticipated Non-Recurring Transactions -->
            <div id="anticipated-highlight" class="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                <h3 class="text-amber-800 font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2"><i class="fa-solid fa-clock"></i> Flux à venir (3 mois, hors récurrences)</h3>
                <div id="anticipated-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"></div>
            </div>

            <!-- Budget Analysis -->
            <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-lg text-slate-800 mb-4">Analyse du Budget</h3>
                    <button id="btn-cloture" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300"><i class="fa-solid fa-lock mr-2"></i>Clôturer le mois</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="relative">
                        <h4 class="font-bold text-slate-700 mb-4">Flux de trésorerie (Sankey)</h4>
                        <button id="btn-expand-sankey" class="absolute top-0 right-0 z-[30] text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md active:scale-95">
                            <i class="fa-solid fa-maximize"></i> Agrandir
                        </button>
                        <div id="sankey-chart" class="w-full h-[320px] bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 text-sm italic">
                            Chargement du graphique...
                        </div>
                    </div>
                    <div class="space-y-6">
                        <div>
                            <h4 class="font-bold text-slate-700 mb-2">Pourcentage des dépenses par rapport aux revenus</h4>
                            <div class="w-full bg-slate-200 rounded-full h-4">
                                <div id="expense-percentage-bar" class="bg-danger h-4 rounded-full" style="width: 0%;"></div>
                            </div>
                            <p class="text-right text-sm font-medium text-slate-500 mt-1"><span id="expense-percentage-text">0%</span></p>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-700 mb-2">Prévisions</h4>
                            <div class="flex items-center gap-4">
                                <p class="text-sm text-slate-500">Solde prévu à la fin du mois:</p>
                                <p class="text-lg font-bold text-slate-800" id="forecast-balance">--</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Liquidity Distribution -->
            <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <h3 class="font-bold text-lg text-slate-800 mb-4">Répartition de la Liquidité</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div id="liquidity-chart" class="w-full h-[320px] bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 text-sm italic">
                        Chargement du graphique...
                    </div>
                    <div id="liquidity-details" class="space-y-3">
                        <!-- Table of accounts, balances, and percentages -->
                    </div>
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderDashboard();
    },
    init: () => {
        // Shared listeners that might be specific to this view's buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#btn-cloture')) {
                import('../dashboard.js').then(m => m.clotureMois());
            }
            if (e.target.closest('#btn-expand-sankey')) {
                const modal = document.getElementById('sankey-modal');
                if (modal) modal.classList.remove('hidden');
                import('../dashboard.js').then(m => m.renderSankeyChart(true));
            }
            if (e.target.closest('#btn-close-sankey-modal')) {
                const modal = document.getElementById('sankey-modal');
                if (modal) modal.classList.add('hidden');
            }
        });
    }
};
