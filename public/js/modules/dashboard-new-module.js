import { renderStrategicDashboard } from '../dashboard-new.js';
import { renderTimeline } from '../dashboard.js';
import { t } from '../i18n.js';

export default {
    id: 'dashboard',
    accentColor: 'indigo',
    get label() { return t('nav.dashboard'); },
    get group() { return t('nav.groups.strategy'); },
    icon: 'fa-gauge-high',
    order: 2,
    showMonthSelection: true,
    getHelpContent: () => ({
        title: t('help_cards.dashboard.title'),
        purpose: t('help_cards.dashboard.purpose'),
        actions: [
            { icon: "fa-chart-line", label: t('help_cards.dashboard.action1_label'), desc: t('help_cards.dashboard.action1_desc') },
            { icon: "fa-shield-heart", label: t('help_cards.dashboard.action2_label'), desc: t('help_cards.dashboard.action2_desc') },
            { icon: "fa-gauge-high", label: t('help_cards.dashboard.action3_label'), desc: t('help_cards.dashboard.action3_desc') }
        ]
    }),
    getFabConfig: () => null,
    getTemplate: () => `
        <div id="view-dashboard" class="space-y-6 max-w-6xl mx-auto px-4 pb-20">
            <!-- Sticky Header -->
            <div class="page-header-sticky space-y-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <h1 class="text-2xl font-bold text-slate-800">${t('dashboard.title')}</h1>
                        <button onclick="window.app.showHelp('dashboard')" class="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-lg"></i>
                        </button>
                    </div>
                    <div class="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        <i class="fa-solid fa-gem text-indigo-600"></i>
                        <span class="text-xs font-bold text-indigo-800 uppercase tracking-wider">${t('dashboard.mode_wealth')}</span>
                    </div>
                </div>

                <!-- Jump Bar (Section Navigation) -->
                <div class="flex gap-2 items-center overflow-x-auto hide-scroll pb-1" id="dash-jump-bar">
                    <button data-section="dash-scorecard" onclick="window.app.jumpToSection('dash-scorecard')" class="jump-link px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 whitespace-nowrap border border-indigo-100 dark:border-indigo-800 shadow-sm transition-all">${t('dashboard.jump.summary')}</button>
                    <button data-section="dash-kpis" onclick="window.app.jumpToSection('dash-kpis')" class="jump-link px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 whitespace-nowrap border border-transparent transition-all">${t('dashboard.jump.indicators')}</button>
                    <button data-section="dash-analysis" onclick="window.app.jumpToSection('dash-analysis')" class="jump-link px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 whitespace-nowrap border border-transparent transition-all">${t('dashboard.jump.analysis')}</button>
                </div>
            </div>
            
            <div id="strategic-dashboard-content">
                <!-- Strategic Dashboard Injected Here -->
                <div class="p-20 text-center text-slate-400 italic">${t('common.loading')}</div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderStrategicDashboard();
    },
    init: () => {
        // Shared listeners already in main.js or other modules
    }
};
