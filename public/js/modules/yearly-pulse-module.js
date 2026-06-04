import { renderYearlyPulse } from '../yearly-pulse.js';
import { renderTimeline } from '../dashboard.js';
import { t } from '../i18n.js';

export default {
    id: 'yearly-pulse',
    appId: 'dashboard',
    accentColor: 'violet',
    get label() { return t('nav.yearly_pulse'); },
    get group() { return t('nav.groups.strategy'); },
    icon: 'fa-calendar-days',
    order: 3,
    showMonthSelection: true,
    getHelpContent: () => ({
        title: t('help_cards.yearly_pulse.title'),
        purpose: t('help_cards.yearly_pulse.purpose'),
        actions: [
            { icon: "fa-calendar-days", label: t('help_cards.yearly_pulse.action1_label'), desc: t('help_cards.yearly_pulse.action1_desc') },
            { icon: "fa-arrows-left-right", label: t('help_cards.yearly_pulse.action2_label'), desc: t('help_cards.yearly_pulse.action2_desc') },
            { icon: "fa-thumbtack", label: t('help_cards.yearly_pulse.action3_label'), desc: t('help_cards.yearly_pulse.action3_desc') }
        ]
    }),
    getFabConfig: () => null,
    getTemplate: () => `
        <div id="view-yearly-pulse" class="space-y-6 max-w-none mx-auto px-4 pb-20">
            <div class="page-header-sticky space-y-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <h1 class="text-2xl font-bold text-slate-800">${t('nav.yearly_pulse')}</h1>
                        <button onclick="window.app.showHelp('yearly-pulse')" class="p-2 text-slate-300 hover:text-violet-900 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-lg"></i>
                        </button>
                    </div>
                    <div class="flex items-center gap-2 md:gap-3">
                        <!-- Navigation Buttons -->
                        <div class="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <button id="prev-month-btn" class="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 transition-colors" title="${t('common.previous')}">
                                <i class="fa-solid fa-chevron-left text-slate-500 text-xs"></i>
                            </button>
                            <button id="next-month-btn" class="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="${t('common.next')}">
                                <i class="fa-solid fa-chevron-right text-slate-500 text-xs"></i>
                            </button>
                        </div>

                        <button id="jump-to-today-btn" class="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 md:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors shadow-sm">
                            <i class="fa-solid fa-calendar-day text-violet-500"></i>
                            <span class="text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">${t('yearly_pulse.jump_to_today')}</span>
                        </button>
                        <div class="hidden md:flex items-center gap-2 bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100">
                            <i class="fa-solid fa-wand-magic-sparkles text-violet-900"></i>
                            <span class="text-xs font-bold text-violet-800 uppercase tracking-wider">${t('common.active_view')}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="yearly-pulse-content">
                <div class="p-20 text-center text-slate-400 italic">${t('common.loading')}</div>
            </div>
        </div>
    `,
    render: () => {
        renderTimeline();
        renderYearlyPulse();
    },
    init: () => {
    }
};
