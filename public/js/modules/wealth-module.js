import { renderWealthList } from '../wealth.js';
import { renderTimeline } from '../dashboard.js';
import { t } from '../i18n.js';

export default {
    id: 'wealth',
    get label() { return t('nav.wealth'); },
    get group() { return t('nav.groups.strategy'); },
    icon: 'fa-gem',
    order: 3,
    showMonthSelection: true,
    showMobileFab: () => true,
    getTemplate: () => `
        <div id="view-wealth" class="space-y-8 max-w-6xl mx-auto px-4 pb-20">
            <div class="flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-black text-slate-800 tracking-tight">Patrimoine & Bilan</h1>
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Suivi des actifs et du désendettement</p>
                </div>
                <button onclick="window.app.openWealthDrawer()" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 flex items-center gap-2 shadow-md uppercase tracking-widest transition-all active:scale-95">
                    <i class="fa-solid fa-plus text-xs"></i> Ajouter
                </button>
            </div>

            <!-- Net Worth Summary -->
            <div id="wealth-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Injected by JS: Total Assets, Total Liabilities, Net Worth -->
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse h-24"></div>
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse h-24"></div>
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse h-24"></div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Assets Side -->
                <section class="space-y-4">
                    <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 class="font-black text-slate-400 uppercase tracking-widest text-xs">ACTIFS (Ce que je possède)</h3>
                        <span id="total-assets-label" class="text-xs font-black text-emerald-600">-- €</span>
                    </div>
                    <div id="wealth-assets-list" class="space-y-3">
                        <!-- Assets Injected -->
                    </div>
                </section>

                <!-- Liabilities Side -->
                <section class="space-y-4">
                    <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 class="font-black text-slate-400 uppercase tracking-widest text-xs">PASSIFS (Ce que je dois)</h3>
                        <span id="total-liabilities-label" class="text-xs font-black text-rose-600">-- €</span>
                    </div>
                    <div id="wealth-liabilities-list" class="space-y-3">
                        <!-- Liabilities Injected -->
                    </div>
                </section>
            </div>

            <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex items-start gap-4">
                <div class="w-10 h-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <i class="fa-solid fa-scale-balanced"></i>
                </div>
                <div>
                    <h4 class="font-bold text-indigo-900">Équilibre du Bilan</h4>
                    <p class="text-sm text-indigo-700 mt-1 leading-relaxed">
                        Le <b>Patrimoine Net</b> représente votre richesse réelle (Actifs - Dettes). 
                        Chaque remboursement de crédit diminue vos passifs et augmente mécaniquement votre patrimoine net, même si votre épargne reste stable.
                    </p>
                </div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderWealthList();
    },
    init: () => {
        // Shared listeners already in main.js
    }
};
