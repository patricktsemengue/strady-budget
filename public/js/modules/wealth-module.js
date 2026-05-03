import { renderWealthList } from '../wealth.js';
import { renderTimeline } from '../dashboard.js';
import { t } from '../i18n.js';

export default {
    id: 'wealth',
    accentColor: 'rose',
    get label() { return t('nav.wealth'); },
    get group() { return t('nav.groups.strategy'); },
    icon: 'fa-gem',
    order: 3,
    showMonthSelection: true,
    getHelpContent: () => ({
        title: t('help_cards.wealth.title'),
        purpose: t('help_cards.wealth.purpose'),
        actions: [
            { icon: "fa-plus-circle", label: t('help_cards.wealth.action1_label'), desc: t('help_cards.wealth.action1_desc') },
            { icon: "fa-clock-rotate-left", label: t('help_cards.wealth.action2_label'), desc: t('help_cards.wealth.action2_desc') },
            { icon: "fa-chart-area", label: t('help_cards.wealth.action3_label'), desc: t('help_cards.wealth.action3_desc') }
        ]
    }),
    getFabConfig: () => ({
        icon: 'fa-gem',
        color: 'bg-rose-600',
        action: () => window.app.openWealthDrawer()
    }),
    getTemplate: () => `
        <div id="view-wealth" class="space-y-8 max-w-6xl mx-auto px-4 pb-20">
            <!-- Sticky Header -->
            <div class="page-header-sticky">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div>
                            <h1 class="text-2xl font-black text-slate-800 tracking-tight">${t('wealth.title')}</h1>
                            <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">${t('wealth.subtitle')}</p>
                        </div>
                        <button onclick="window.app.showHelp('wealth')" class="p-2 text-slate-300 hover:text-rose-600 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-lg"></i>
                        </button>
                    </div>
                    <button id="btn-add-wealth-desktop" onclick="window.app.openWealthDrawer()" class="hidden md:flex bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 items-center gap-2 shadow-md uppercase tracking-widest transition-all active:scale-95">
                        <i class="fa-solid fa-plus text-xs"></i> ${t('common.add')}
                    </button>
                </div>
            </div>

            <!-- Net Worth Summary -->
            <div id="wealth-summary" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Assets Card -->
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-emerald-200 transition-all">
                    <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-gem"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('wealth.total_assets')}</p>
                        <p id="wealth-stat-assets" class="text-2xl font-black text-slate-900">€0,00</p>
                    </div>
                </div>

                <!-- Liabilities Card -->
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-rose-200 transition-all">
                    <div class="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-hand-holding-dollar"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('wealth.total_liabilities')}</p>
                        <p id="wealth-stat-liabilities" class="text-2xl font-black text-rose-600">€0,00</p>
                    </div>
                </div>

                <!-- Net Wealth Card -->
                <div class="bg-indigo-600 rounded-2xl p-6 shadow-lg shadow-indigo-100 flex items-center gap-5 group hover:bg-indigo-700 transition-all">
                    <div class="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-2xl shadow-inner group-hover:rotate-12 transition-transform">
                        <i class="fa-solid fa-scale-balanced"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">${t('wealth.net_equity')}</p>
                        <p id="wealth-stat-net" class="text-2xl font-black text-white italic">€0,00</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Assets Side -->
                <section class="space-y-4">
                    <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 class="font-black text-slate-400 uppercase tracking-widest text-xs">${t('wealth.assets_label')}</h3>
                        <span id="total-assets-label" class="text-xs font-black text-emerald-600">-- €</span>
                    </div>
                    <div id="wealth-assets-list" class="space-y-3">
                        <!-- Assets Injected -->
                    </div>
                </section>

                <!-- Liabilities Side -->
                <section class="space-y-4">
                    <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 class="font-black text-slate-400 uppercase tracking-widest text-xs">${t('wealth.liabilities_label')}</h3>
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
                    <h4 class="font-bold text-indigo-900">${t('wealth.balance_title')}</h4>
                    <p class="text-sm text-indigo-700 mt-1 leading-relaxed">
                        ${t('wealth.balance_desc')}
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
