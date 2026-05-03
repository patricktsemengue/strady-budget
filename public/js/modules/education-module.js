import { router } from '../app-router.js';
import { t } from '../i18n.js';

export default {
    id: 'education',
    accentColor: 'violet',
    get label() { return t('nav.education'); },
    get group() { return t('nav.groups.strategy'); },
    icon: 'fa-graduation-cap',
    order: 1,
    showMonthSelection: false,
    getHelpContent: () => ({
        title: t('help_cards.education.title'),
        purpose: t('help_cards.education.purpose'),
        actions: [
            { icon: "fa-graduation-cap", label: t('help_cards.education.action1_label'), desc: t('help_cards.education.action1_desc') },
            { icon: "fa-book-open", label: t('help_cards.education.action2_label'), desc: t('help_cards.education.action2_desc') },
            { icon: "fa-wand-magic-sparkles", label: t('help_cards.education.action3_label'), desc: t('help_cards.education.action3_desc') }
        ]
    }),
    getFabConfig: () => null,
    getTemplate: () => `
        <div id="view-education" class="max-w-4xl mx-auto px-4 pb-20">
            <!-- Sticky Header -->
            <div class="page-header-sticky mb-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div>
                            <h1 class="text-3xl font-black text-slate-800">${t('education.title')}</h1>
                            <p class="text-slate-500 font-medium italic">${t('education.subtitle')}</p>
                        </div>
                        <button onclick="window.app.showHelp('education')" class="p-2 text-slate-300 hover:text-violet-600 transition-colors" title="${t('help_cards.btn_help')}">
                            <i class="fa-solid fa-circle-question text-xl"></i>
                        </button>
                    </div>
                    <div class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                        ${t('education.badge')}
                    </div>
                </div>
            </div>

            <!-- Mastery Center -->
            <div class="mb-12">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-slate-800">${t('mastery.title')}</h2>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-wider">${t('mastery.subtitle')}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Mission 1: Trajectory -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform"></div>
                        <div class="relative">
                            <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 text-xl shadow-inner">
                                <i class="fa-solid fa-rocket"></i>
                            </div>
                            <h3 class="font-black text-slate-800 mb-2">${t('mastery.mission1_title')}</h3>
                            <p class="text-xs text-slate-500 leading-relaxed mb-6">${t('mastery.mission1_desc')}</p>
                            <button onclick="window.app.startTour('budget')" class="w-full py-2.5 bg-slate-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-emerald-100">
                                ${t('mastery.btn_launch')}
                            </button>
                        </div>
                    </div>

                    <!-- Mission 2: Wealth -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform"></div>
                        <div class="relative">
                            <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 text-xl shadow-inner">
                                <i class="fa-solid fa-gem"></i>
                            </div>
                            <h3 class="font-black text-slate-800 mb-2">${t('mastery.mission2_title')}</h3>
                            <p class="text-xs text-slate-500 leading-relaxed mb-6">${t('mastery.mission2_desc')}</p>
                            <button onclick="window.app.startTour('wealth')" class="w-full py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-indigo-100">
                                ${t('mastery.btn_launch')}
                            </button>
                        </div>
                    </div>

                    <!-- Mission 3: Entities -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 w-20 h-20 bg-violet-50 rounded-full group-hover:scale-150 transition-transform"></div>
                        <div class="relative">
                            <div class="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-4 text-xl shadow-inner">
                                <i class="fa-solid fa-building-user"></i>
                            </div>
                            <h3 class="font-black text-slate-800 mb-2">${t('mastery.mission3_title')}</h3>
                            <p class="text-xs text-slate-500 leading-relaxed mb-6">${t('mastery.mission3_desc')}</p>
                            <button onclick="window.app.startTour('entities')" class="w-full py-2.5 bg-slate-50 hover:bg-violet-600 hover:text-white text-violet-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-violet-100">
                                ${t('mastery.btn_launch')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Concepts Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <!-- Concept 1: Pay Yourself First -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-piggy-bank"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">${t('education.concepts.pyf.title')}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        ${t('education.concepts.pyf.desc')}
                    </p>
                    <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <p class="text-xs font-bold text-emerald-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-emerald-700 leading-relaxed italic">
                            ${t('education.concepts.pyf.app')}
                        </p>
                    </div>
                </div>

                <!-- Concept 2: 70/20/10 Rule -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-chart-pie"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">${t('education.concepts.rule.title')}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        ${t('education.concepts.rule.desc')}
                    </p>
                    <ul class="space-y-2 mb-4">
                        <li class="flex items-center text-xs font-bold text-slate-700">
                            <span class="w-8 text-indigo-500">70%</span> ${t('education.concepts.rule.needs')}
                        </li>
                        <li class="flex items-center text-xs font-bold text-slate-700">
                            <span class="w-8 text-amber-500">20%</span> ${t('education.concepts.rule.wants')}
                        </li>
                        <li class="flex items-center text-xs font-bold text-slate-700">
                            <span class="w-8 text-emerald-500">10%</span> ${t('education.concepts.rule.savings')}
                        </li>
                    </ul>
                    <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p class="text-xs font-bold text-indigo-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-indigo-700 leading-relaxed italic">
                            ${t('education.concepts.rule.app')}
                        </p>
                    </div>
                </div>

                <!-- Concept 3: Emergency Fund -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">${t('education.concepts.emergency.title')}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        ${t('education.concepts.emergency.desc')}
                    </p>
                    <div class="bg-rose-50 p-4 rounded-xl border border-rose-100">
                        <p class="text-xs font-bold text-rose-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-rose-700 leading-relaxed italic">
                            ${t('education.concepts.emergency.app')}
                        </p>
                    </div>
                </div>

                <!-- Concept 4: Cash Drag -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-6 text-xl">
                        <i class="fa-solid fa-bolt-lightning"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-3">${t('education.concepts.cash_drag.title')}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed mb-4">
                        ${t('education.concepts.cash_drag.desc')}
                    </p>
                    <div class="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <p class="text-xs font-bold text-amber-800 uppercase mb-2">Application Strady :</p>
                        <p class="text-xs text-amber-700 leading-relaxed italic">
                            ${t('education.concepts.cash_drag.app')}
                        </p>
                    </div>
                </div>

                <!-- Concept 5: Indice de Souveraineté (FFI) -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow md:col-span-2">
                    <div class="flex flex-col md:flex-row gap-8 items-center">
                        <div class="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-indigo-200">
                            <i class="fa-solid fa-crown"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-slate-800 mb-2">${t('education.concepts.ffi.title')}</h3>
                            <p class="text-sm text-slate-600 leading-relaxed mb-4">
                                ${t('education.concepts.ffi.desc')}
                            </p>
                            <div class="flex gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <div>
                                    <p class="text-[10px] font-black text-indigo-800 uppercase mb-1">${t('education.concepts.ffi.target')}</p>
                                    <p class="text-xs text-indigo-700 italic">${t('education.concepts.ffi.help')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- User Manual Section -->
            <div class="bg-slate-900 text-white rounded-3xl p-10 shadow-2xl overflow-hidden relative">
                <div class="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl"></div>
                <div class="relative">
                    <h2 class="text-2xl font-black mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                        <i class="fa-solid fa-book-open text-indigo-400"></i>
                        ${t('education.guide.title')}
                    </h2>
                    
                    <div class="space-y-10">
                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">${t('education.guide.step1_title')}</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                ${t('education.guide.step1_desc')}
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">${t('education.guide.step2_title')}</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                ${t('education.guide.step2_desc')}
                            </p>
                        </div>

                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">${t('education.guide.step3_title')}</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                ${t('education.guide.step3_desc')}
                            </p>
                        </div>

                        <div>
                            <h4 class="text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">${t('education.guide.step4_title')}</h4>
                            <p class="text-slate-300 text-sm leading-relaxed">
                                ${t('education.guide.step4_desc')}
                            </p>
                        </div>
                    </div>

                    <div class="mt-12 pt-8 border-t border-white/10 text-center">
                        <button onclick="window.location.hash = 'dashboard'" class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black transition-all shadow-lg shadow-indigo-900/40">
                            ${t('education.guide.cta')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    render: () => {
        // Static content, no complex logic needed here
    },
    init: () => {}
};
