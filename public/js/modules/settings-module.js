import { t, getCurrentLanguage } from '../i18n.js';
import { state, updateState } from '../state.js';
import { currencyMap } from '../currencies.js';
import { formatCurrency } from '../utils.js';

export default {
    id: 'settings',
    accentColor: 'slate',
    get label() { return t('nav.settings'); },
    get group() { return t('nav.groups.config'); },
    icon: 'fa-cog',
    order: 10,
    showMonthSelection: false,
    getHelpContent: () => ({
        title: t('help_cards.settings.title'),
        purpose: t('help_cards.settings.purpose'),
        actions: [
            { icon: "fa-calendar-days", label: t('help_cards.settings.action1_label'), desc: t('help_cards.settings.action1_desc') },
            { icon: "fa-vault", label: t('help_cards.settings.action2_label'), desc: t('help_cards.settings.action2_desc') },
            { icon: "fa-language", label: t('help_cards.settings.action3_label'), desc: t('help_cards.settings.action3_desc') }
        ]
    }),
    getFabConfig: () => null,
    getTemplate: () => {
        const displayOptions = Object.entries(currencyMap).map(([code, info]) => 
            `<option value="${code}" ${state.displayCurrency === code ? 'selected' : ''}>${info.symbol} ${info.label} (${code})</option>`
        ).join('');

        const ratesCardsMobile = Object.entries(state.exchangeRates || {}).map(([code, rate]) => {
            const info = currencyMap[code] || { symbol: '', label: code };
            return `
                <div data-id="${code}" class="swipe-item relative overflow-hidden rounded-xl group shadow-sm mb-3">
                    <!-- Action Layers -->
                    <div class="absolute inset-0 bg-rose-600 flex justify-end items-center px-6 text-white">
                        <button onclick="window.app.deleteExchangeRate('${code}')" class="flex flex-col items-center gap-1">
                            <i class="fa-solid fa-trash-can text-lg"></i>
                            <span class="text-[8px] font-bold uppercase tracking-tighter">Supprimer</span>
                        </button>
                    </div>

                    <!-- Content Layer -->
                    <div class="swipe-content relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between gap-4 transition-all duration-200">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                                ${info.symbol}
                            </div>
                            <div>
                                <p class="font-bold text-slate-800 dark:text-slate-100">${code}</p>
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">1 ${code} = ${rate} ${state.displayCurrency}</p>
                            </div>
                        </div>
                        <input type="number" step="0.0001" value="${rate}" 
                            onchange="window.app.updateExchangeRate('${code}', this.value)"
                            class="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-1 focus:ring-indigo-500">
                    </div>
                </div>
            `;
        }).join('');

        const ratesRows = Object.entries(state.exchangeRates || {}).map(([code, rate]) => {
            const info = currencyMap[code] || { symbol: '', label: code };
            return `
                <tr class="border-b border-slate-50 dark:border-slate-800 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-xs">
                    <td class="py-3 px-4">
                        <span class="font-bold text-slate-700 dark:text-slate-300">${state.displayCurrency}</span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            <span class="font-black text-indigo-600 dark:text-indigo-400">${info.symbol}</span>
                            <span class="font-bold text-slate-700 dark:text-slate-300">${code}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">1 ${code} =</span>
                            <input type="number" step="0.0001" value="${rate}" 
                                onchange="window.app.updateExchangeRate('${code}', this.value)"
                                class="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-1 focus:ring-indigo-500">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${state.displayCurrency}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex items-center justify-between gap-4">
                            <a href="https://www.google.com/finance/quote/${code}-${state.displayCurrency}" target="_blank" class="text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                ${t('settings.currency.verify')}
                            </a>
                            <button onclick="window.app.deleteExchangeRate('${code}')" class="ghost-action-btn p-2 text-slate-300 hover:text-rose-500 transition-all">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const renderCardHeader = (title, subtitle, why, impact, icon, iconColor) => `
            <div class="p-6 flex items-start justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center shadow-sm">
                        <i class="fa-solid ${icon} text-lg"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-3">
                            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base">${title}</h3>
                            <span class="impact-badge impact-${impact}">${t(`settings.impact.${impact}`)}</span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${subtitle}</p>
                    </div>
                </div>
                
                <!-- Tooltip: Info & Impact -->
                <div class="relative group/why">
                    <button class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm">
                        <i class="fa-solid fa-info text-xs"></i>
                    </button>
                    <div class="absolute top-0 right-full mr-3 w-72 p-4 bg-slate-800 text-white text-xs rounded-2xl opacity-0 invisible group-hover/why:opacity-100 group-hover/why:visible transition-all z-50 shadow-2xl border border-slate-700 leading-relaxed pointer-events-none">
                        <div class="flex items-center gap-2 mb-2 text-indigo-400 font-black uppercase tracking-widest text-[10px]">
                            <i class="fa-solid fa-lightbulb"></i>
                            <span>Objectif & Conséquences</span>
                        </div>
                        ${why}
                    </div>
                </div>
            </div>
        `;

        const sidebarItems = [
            { id: 'group-display', label: t('settings.groups_settings.display'), icon: 'fa-desktop' },
            { id: 'group-entities', label: 'Entités & Famille', icon: 'fa-people-roof' },
            { id: 'group-strategy', label: t('settings.groups_settings.strategy'), icon: 'fa-bullseye' },
            { id: 'group-connectivity', label: t('settings.groups_settings.connectivity'), icon: 'fa-link' },
            { id: 'group-security', label: t('settings.groups_settings.security'), icon: 'fa-shield-halved' }
        ];

        const entityCards = state.entities.map(ent => {
            const countAccounts = state.accounts.filter(a => a.entityId === ent.id).length;
            const countTransactions = (state.transactions || []).filter(t => t.entityId === ent.id).length;
            const countAssets = state.assets.filter(a => a.entityId === ent.id).length;
            const countLiabilities = state.liabilities.filter(l => l.entityId === ent.id).length;
            
            const isDeletable = countAccounts === 0 && countTransactions === 0 && countAssets === 0 && countLiabilities === 0;
            const linkCount = countAccounts + countAssets + countLiabilities;

            return `
                <div data-id="${ent.id}" class="swipe-item relative overflow-hidden rounded-xl group shadow-sm mb-1">
                    <!-- Action Layers (Mobile Swipe Only) -->
                    <div class="absolute inset-0 bg-rose-600 flex justify-end items-center px-6 text-white md:hidden">
                        <button onclick="window.app.deleteEntity('${ent.id}')" class="flex flex-col items-center gap-1">
                            <i class="fa-solid fa-trash-can text-lg"></i>
                            <span class="text-[8px] font-bold uppercase tracking-tighter">${t('common.delete')}</span>
                        </button>
                    </div>

                    <!-- Content Layer -->
                    <div class="swipe-content relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between transition-all duration-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                                <i class="fa-solid ${ent.type === 'PRIVATE' ? 'fa-user' : (ent.type === 'FAMILY' ? 'fa-people-roof' : 'fa-briefcase')} text-sm"></i>
                            </div>
                            <div>
                                <p class="font-bold text-slate-800 dark:text-slate-100">${ent.name}</p>
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${t(`entities.type_${ent.type.toLowerCase()}`)} • ${linkCount} ${t('nav.groups.operations').toLowerCase()}</p>
                            </div>
                        </div>

                        <!-- Desktop Actions (Hidden on Mobile) -->
                        <div class="hidden md:flex items-center gap-1">
                            <button onclick="window.app.openEditEntity('${ent.id}')" class="p-2 text-slate-300 hover:text-indigo-600 transition-all" title="${t('common.edit')}">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                            <button onclick="window.app.deleteEntity('${ent.id}')" 
                                    class="p-2 text-slate-300 hover:text-rose-500 transition-all ${!isDeletable ? 'opacity-10 cursor-not-allowed' : ''}" 
                                    ${!isDeletable ? `title="${t('entities.error_linked')}"` : `title="${t('common.delete')}"`}>
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>

                        <!-- Mobile Indicator (Hidden on Desktop) -->
                        <div class="md:hidden text-slate-200">
                             <i class="fa-solid fa-chevron-left text-[10px]"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
        <div id="view-settings" class="max-w-6xl mx-auto px-4 pb-20">
            
            <!-- Universal Sticky Header (Matches Strady Header Style) -->
            <div class="page-header-sticky mb-10">
                <div class="flex flex-col gap-5">
                    <!-- Title Row -->
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-4">
                            <div>
                                <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">${t('settings.title')}</h1>
                                <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">${t('settings.groups_settings.display')}</p>
                            </div>
                            <button onclick="window.app.showHelp('settings')" class="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="${t('help_cards.btn_help')}">
                                <i class="fa-solid fa-circle-question text-lg"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Horizontal Jump Bar (Pill Buttons - Responsive Wrap) -->
                    <div class="flex flex-wrap items-center gap-2 pb-1" id="settings-jump-bar">
                        ${sidebarItems.map(item => `
                            <button onclick="window.app.scrollToSettingsGroup('${item.id}')" class="settings-sidebar-link whitespace-nowrap flex items-center gap-2.5 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border bg-white dark:bg-slate-900 shadow-sm text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <i class="fa-solid ${item.icon} text-[11px]"></i>
                                ${item.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="w-full space-y-12">
                <!-- 1. GROUP: DISPLAY -->
                <div id="group-display" class="space-y-4">
                        <div class="flex items-center gap-2 mb-2 ml-1">
                            <div class="w-1 h-4 bg-indigo-500 rounded-full"></div>
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t('settings.groups_settings.display')}</h4>
                        </div>

                        <!-- Card: Master Currency -->
                        <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                            ${renderCardHeader(t('settings.currency.title_master'), t('settings.currency.subtitle_master'), t('settings.currency.why_master'), 'data', 'fa-coins', 'bg-amber-50 dark:bg-amber-900/20 text-amber-600')}
                            <div class="px-6 pb-6 pt-2">
                                <div class="flex flex-col md:flex-row gap-6 items-center">
                                    <div class="flex-1 w-full">
                                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">${t('settings.currency.label_app')}</label>
                                        <select onchange="window.app.updateCurrencySettings({ displayCurrency: this.value })" class="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200">
                                            ${displayOptions}
                                        </select>
                                    </div>
                                    <div class="w-full md:w-auto p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 text-center">
                                        <p class="text-[10px] font-black text-indigo-400 uppercase mb-1">Aperçu</p>
                                        <p class="text-xl font-black text-indigo-600 dark:text-indigo-400">${formatCurrency(1250.50)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>

                        <!-- 2. GROUP: ENTITIES -->
                        <div id="group-entities" class="space-y-4 pt-4">
                            <div class="flex items-center gap-2 mb-2 ml-1">
                                <div class="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t('entities.title')}</h4>
                            </div>

                            <!-- Card: Entities List -->
                            <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                                ${renderCardHeader(t('entities.title'), t('entities.subtitle'), 'Les entités permettent de filtrer votre patrimoine et votre trésorerie par "propriétaire". Idéal pour les couples ou les entrepreneurs.', 'data', 'fa-people-roof', 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600')}
                                <div class="px-6 pb-6 pt-2 space-y-4">
                                    <div id="entities-swipe-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        ${entityCards || `<div class="col-span-2 py-8 text-center text-slate-400 italic">Aucune entité configurée</div>`}
                                    </div>

                                    <div class="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <h5 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">${t('entities.add_title')}</h5>
                                        <form id="add-entity-form" class="flex flex-col md:flex-row gap-3">
                                            <input type="text" id="new-entity-name" placeholder="${t('entities.name_placeholder')}" required class="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm font-bold">
                                            <select id="new-entity-type" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm font-bold">
                                                <option value="PRIVATE">${t('entities.type_private')}</option>
                                                <option value="FAMILY">${t('entities.type_family')}</option>
                                                <option value="SMALL_BUSINESS">${t('entities.type_business')}</option>
                                            </select>
                                            <button type="submit" class="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                                                <i class="fa-solid fa-plus mr-2"></i> ${t('common.add')}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 3. GROUP: STRATEGY -->
                    <div id="group-strategy" class="space-y-4 pt-4">
                        <div class="flex items-center gap-2 mb-2 ml-1">
                            <div class="w-1 h-4 bg-emerald-500 rounded-full"></div>
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t('settings.groups_settings.strategy')}</h4>
                        </div>

                        <!-- Card: Horizon -->
                        <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                            ${renderCardHeader(t('settings.horizon.title'), t('settings.horizon.subtitle'), t('settings.horizon.why'), 'calc', 'fa-calendar-days', 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600')}
                            <div class="px-6 pb-6 pt-2 space-y-6">
                                <div class="flex flex-wrap gap-3">
                                    <button onclick="window.app.setSettingPreset('cfo')" class="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-800">${t('settings.horizon.preset_cfo')}</button>
                                    <button onclick="window.app.setSettingPreset('history')" class="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">${t('settings.horizon.preset_history')}</button>
                                    <button onclick="window.app.setSettingPreset('year')" class="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">${t('settings.horizon.preset_year')}</button>
                                </div>
                                <form id="month-selector-config-form" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">${t('settings.horizon.start_date')}</label>
                                        <input type="date" id="config-month-start" required class="w-full border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl p-3 text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">${t('settings.horizon.end_date')}</label>
                                        <input type="date" id="config-month-end" required class="w-full border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl p-3 text-sm">
                                    </div>
                                    <div class="md:col-span-2 flex justify-end">
                                        <button type="submit" class="bg-slate-800 dark:bg-indigo-600 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg hover:scale-95 transition-all">
                                            ${t('settings.horizon.save')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <!-- Card: EF Multiplier -->
                        <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                            ${renderCardHeader(t('settings.strategy.title'), t('settings.strategy.subtitle'), t('settings.strategy.why'), 'calc', 'fa-bullseye', 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600')}
                            <div class="px-6 pb-6 pt-2">
                                <div class="max-w-md">
                                    <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">${t('settings.strategy.ef_goal')}</label>
                                    <div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <button onclick="window.app.updateEFMultiplier(3)" id="btn-ef-3" class="flex-1 py-3 rounded-xl text-sm font-bold transition-all ${state.emergencyFundMultiplier === 3 ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}">3 mois</button>
                                        <button onclick="window.app.updateEFMultiplier(6)" id="btn-ef-6" class="flex-1 py-3 rounded-xl text-sm font-bold transition-all ${state.emergencyFundMultiplier === 6 ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}">6 mois</button>
                                        <button onclick="window.app.updateEFMultiplier(12)" id="btn-ef-12" class="flex-1 py-3 rounded-xl text-sm font-bold transition-all ${state.emergencyFundMultiplier === 12 ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}">12 mois</button>
                                    </div>
                                    <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed italic">
                                        ${t('settings.strategy.ef_help')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. GROUP: CONNECTIVITY -->
                    <div id="group-connectivity" class="space-y-4 pt-4">
                        <div class="flex items-center gap-2 mb-2 ml-1">
                            <div class="w-1 h-4 bg-blue-500 rounded-full"></div>
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t('settings.groups_settings.connectivity')}</h4>
                        </div>

                        <!-- Card: Currency Rates -->
                        <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                            ${renderCardHeader(t('settings.currency.title_rates'), t('settings.currency.subtitle_rates'), t('settings.currency.why_rates'), 'calc', 'fa-chart-line', 'bg-violet-50 dark:bg-violet-900/20 text-violet-600')}
                            <div class="px-0 pb-6">
                                <div class="overflow-x-auto">
                                    <table class="hidden md:table w-full text-left border-collapse">
                                        <thead>
                                            <tr class="bg-slate-50/50 dark:bg-slate-800/30">
                                                <th class="py-3 px-4 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">${t('settings.currency.col_master')}</th>
                                                <th class="py-3 px-4 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">${t('settings.currency.col_target')}</th>
                                                <th class="py-3 px-4 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">${t('settings.currency.col_value')}</th>
                                                <th class="py-3 px-4 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">${t('settings.currency.col_verify')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${ratesRows || `<tr><td colspan="4" class="py-8 text-center text-slate-400 italic">${t('wealth.no_assets')}</td></tr>`}
                                        </tbody>
                                    </table>
                                    <div id="currency-rates-mobile" class="md:hidden px-4 pt-4">
                                        ${ratesCardsMobile || `<div class="py-8 text-center text-slate-400 italic">${t('wealth.no_assets')}</div>`}
                                    </div>
                                </div>
                                <div class="p-6">
                                    <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <select id="new-rate-code" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm">
                                            ${Object.entries(currencyMap).filter(([c]) => c !== state.displayCurrency && !(state.exchangeRates || {})[c]).map(([c, i]) => `<option value="${c}">${i.symbol} ${c}</option>`).join('')}
                                        </select>
                                        <button onclick="window.app.addExchangeRate(document.getElementById('new-rate-code').value)" class="bg-slate-800 dark:bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md active:scale-95">
                                            <i class="fa-solid fa-plus mr-2"></i> ${t('settings.currency.add_rate')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. GROUP: SECURITY -->
                    <div id="group-security" class="space-y-4 pt-4">
                        <div class="flex items-center gap-2 mb-2 ml-1">
                            <div class="w-1 h-4 bg-rose-500 rounded-full"></div>
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${t('settings.groups_settings.security')}</h4>
                        </div>

                        <!-- Card: Vault -->
                        <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                            ${renderCardHeader(t('settings.vault.title'), t('settings.vault.subtitle'), t('settings.vault.why'), 'data', 'fa-vault', 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}
                            <div class="px-6 pb-6 pt-2 space-y-6">
                                <div class="flex gap-4">
                                    <button id="btn-export-full-backup" class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-center hover:bg-slate-50 transition-all group/btn">
                                        <i class="fa-solid fa-download text-indigo-500 text-2xl mb-2 group-hover/btn:scale-110 transition-transform"></i>
                                        <p class="text-xs font-black uppercase text-slate-700 dark:text-slate-300">${t('settings.vault.backup')}</p>
                                    </button>
                                    <button onclick="document.getElementById('import-zone-wrapper').classList.toggle('hidden')" class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-center hover:bg-slate-50 transition-all group/btn">
                                        <i class="fa-solid fa-upload text-blue-500 text-2xl mb-2 group-hover/btn:scale-110 transition-transform"></i>
                                        <p class="text-xs font-black uppercase text-slate-700 dark:text-slate-300">${t('settings.vault.restore')}</p>
                                    </button>
                                </div>
                                <div id="import-zone-wrapper" class="hidden border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 bg-slate-50 dark:bg-slate-800/30 text-center">
                                     <input type="file" id="full-backup-import-input" class="hidden" accept=".csv">
                                     <div onclick="document.getElementById('full-backup-import-input').click()" class="cursor-pointer flex flex-col items-center">
                                         <i class="fa-solid fa-cloud-arrow-up text-4xl text-slate-300 mb-4"></i>
                                         <p class="text-sm font-bold text-slate-600 dark:text-slate-400">${t('settings.vault.import_dropzone')}</p>
                                         <p class="text-xs text-slate-400 mt-1">${t('settings.vault.import_help')}</p>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card: Maintenance -->
                        <div class="settings-card bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden border-l-4 border-l-rose-500">
                            ${renderCardHeader(t('settings.maintenance.title'), t('settings.maintenance.subtitle'), t('settings.maintenance.why'), 'data', 'fa-screwdriver-wrench', 'bg-rose-50 dark:bg-rose-900/20 text-rose-600')}
                            <div class="px-6 pb-6 pt-2 space-y-6">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <h5 class="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tighter">${t('settings.maintenance.reset_starter')}</h5>
                                        <p class="text-[10px] text-slate-400 mb-4 leading-relaxed">${t('settings.maintenance.reset_starter_help')}</p>
                                        <button id="btn-factory-reset-starter" class="w-full py-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Réinitialiser</button>
                                    </div>
                                    <div class="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20">
                                        <h5 class="text-sm font-black text-rose-700 dark:text-rose-400 mb-2 uppercase tracking-tighter">${t('settings.maintenance.reset_wipe')}</h5>
                                        <p class="text-[10px] text-rose-400 mb-4 leading-relaxed">${t('settings.maintenance.reset_wipe_help')}</p>
                                        <button id="btn-factory-reset-wipe" class="w-full py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md">Détruire</button>
                                    </div>
                                </div>
                                <div class="pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-end">
                                    <button id="btn-logout-settings" class="px-8 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all">
                                        <i class="fa-solid fa-right-from-bracket"></i> ${t('settings.maintenance.logout')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
        `;
    },
    render: () => {
        import('../settings.js').then(m => m.renderSettings());

        // Initialize SwipeManager for mobile components AFTER render
        if (window.innerWidth < 768) {
            import('../ui.js').then(m => {
                setTimeout(() => {
                    new m.SwipeManager('currency-rates-mobile', {
                        onSwipeRight: (id) => import('../settings.js').then(s => s.deleteExchangeRate(id))
                    });
                    new m.SwipeManager('entities-swipe-list', {
                        onTap: (id) => window.app.openEditEntity(id)
                    });
                }, 150);
            });
        }
    },
    init: () => {
        window.app.scrollToSettingsGroup = (groupId) => {
            const el = document.getElementById(groupId);
            if (el) {
                const navHeight = 180; // Adjusted for new header + jump bar height
                const offset = el.getBoundingClientRect().top + window.pageYOffset - navHeight;
                window.scrollTo({ top: offset, behavior: 'smooth' });
            }
        };

        window.app.openEditEntity = (id) => {
            const ent = state.entities.find(e => e.id === id);
            if (!ent) return;
            document.getElementById('edit-ent-id').value = ent.id;
            document.getElementById('edit-ent-name').value = ent.name;
            document.getElementById('edit-ent-type').value = ent.type;
            
            document.getElementById('drawer-overlay').classList.add('active');
            document.getElementById('entity-edit-drawer').classList.add('active');
        };

        window.app.closeEditEntity = () => {
            document.getElementById('drawer-overlay').classList.remove('active');
            document.getElementById('entity-edit-drawer').classList.remove('active');
        };

        const handleUpdateEntity = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-ent-id').value;
            const name = document.getElementById('edit-ent-name').value.trim();
            const type = document.getElementById('edit-ent-type').value;

            try {
                import('../firestore-service.js').then(async m => {
                    await m.updateEntityInFirestore(state.user?.uid || '', id, { name, type });
                    window.app.closeEditEntity();
                    import('../ui.js').then(ui => ui.showNotification(t('common.success')));
                });
            } catch (err) {
                console.error(err);
            }
        };

        // Sidebar active state on scroll
        const groups = ['group-display', 'group-entities', 'group-strategy', 'group-connectivity', 'group-security'];
        const updateActiveLink = () => {
            let current = '';
            for (const id of groups) {
                const el = document.getElementById(id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top < 250) { // Detection threshold
                        current = id;
                    }
                }
            }
            
            document.querySelectorAll('.settings-sidebar-link').forEach(link => {
                const isMatch = link.getAttribute('onclick')?.includes(current);
                
                if (isMatch) {
                    link.classList.add('active', 'bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-md');
                    link.classList.remove('text-slate-500', 'hover:bg-slate-50', 'dark:hover:bg-slate-800', 'border-slate-100', 'dark:border-slate-800');
                } else {
                    link.classList.remove('active', 'bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-md');
                    link.classList.add('text-slate-500', 'border-slate-100', 'dark:border-slate-800');
                }
            });
        };
        window.addEventListener('scroll', updateActiveLink);
        setTimeout(updateActiveLink, 100); // Initial check

        document.addEventListener('submit', (e) => {
            if (e.target.id === 'month-selector-config-form') {
                import('../settings.js').then(m => m.handleSaveMonthSelectorConfig(e));
            }
            if (e.target.id === 'add-entity-form') {
                import('../settings.js').then(m => m.handleAddEntity(e));
            }
            if (e.target.id === 'edit-entity-form') {
                handleUpdateEntity(e);
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-cancel-edit-ent' || e.target.id === 'btn-close-edit-ent-drawer') {
                window.app.closeEditEntity();
            }
            if (e.target.id === 'btn-export-full-backup' || e.target.closest('#btn-export-full-backup')) {
                import('../data.js').then(m => m.exportFullBackupCSV());
            }
            if (e.target.id === 'btn-factory-reset-starter') {
                import('../data.js').then(m => m.handleFactoryReset('starter'));
            }
            if (e.target.id === 'btn-factory-reset-wipe') {
                import('../data.js').then(m => m.handleFactoryReset('scratch'));
            }
            if (e.target.id === 'btn-logout-settings') {
                import('../auth.js').then(m => {
                    if (confirm(t('confirm.logout'))) {
                        m.logout();
                    }
                });
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'full-backup-import-input') {
                import('../data.js').then(m => m.importFullBackupCSV(e));
            }
        });
    }
};
