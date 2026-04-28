import { state } from './state.js';
import { formatCurrency, getMonthKey, getTxDisplayInfo } from './utils.js';
import { calculateBalances, calculateMonthlyIncome, calculateActualBurnRate } from './calculations.js';
import { t } from './i18n.js';

/**
 * Helper to calculate core metrics for a specific month
 */
const getMonthlyMetrics = (date) => {
    const monthKey = getMonthKey(date);
    const monthData = state.records[monthKey] || { items: [], status: 'open' };
    
    const monthIncome = calculateMonthlyIncome(date);
    const monthExpense = monthData.items
        .filter(item => getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);

    // Split Fixed vs Variable
    const fixedExpense = monthData.items
        .filter(item => {
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            if (!txInfo.isExpense) return false;
            const cat = state.categories.find(c => c.id === item.Category);
            return cat?.nature === 'FIXE';
        })
        .reduce((sum, item) => sum + item.amount, 0);

    // 70/20/10 Breakdown
    const needs = monthData.items
        .filter(item => {
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            if (!txInfo.isExpense) return false;
            const cat = state.categories.find(c => c.id === item.Category);
            return cat?.nature === 'FIXE' || cat?.nature === 'QUOTIDIEN';
        })
        .reduce((sum, item) => sum + item.amount, 0);

    const leisure = monthData.items
        .filter(item => {
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            if (!txInfo.isExpense) return false;
            const cat = state.categories.find(c => c.id === item.Category);
            return cat?.nature === 'LOISIR';
        })
        .reduce((sum, item) => sum + item.amount, 0);

    const savings = monthData.items
        .filter(item => {
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            const cat = state.categories.find(c => c.id === item.Category);
            return (cat?.nature === 'EPARGNE' && txInfo.isExpense) || (!txInfo.isIncome && !txInfo.isExpense && !!state.accounts.find(a => a.id === item.destination && a.isSaving));
        })
        .reduce((sum, item) => sum + item.amount, 0);

    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
    
    // Active vs Passive segmentation
    const passiveIncome = monthData.items
        .filter(item => {
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            if (!txInfo.isIncome) return false;
            const cat = state.categories.find(c => c.id === item.Category);
            return !!cat?.isPassive;
        })
        .reduce((sum, item) => sum + item.amount, 0);
    const activeIncome = monthIncome - passiveIncome;

    return { 
        income: monthIncome, 
        expense: monthExpense, 
        fixedExpense, 
        savingsRate,
        passiveIncome,
        activeIncome,
        allocation: { needs, leisure, savings },
        label: new Intl.DateTimeFormat('fr-BE', { month: 'short' }).format(date)
    };
};

export const openKPIInfo = (kpiKey) => {
    const defs = {
        net_worth: {
            title: t('dashboard.net_worth'),
            icon: 'fa-chart-line',
            definition: t('dashboard.kpi.net_worth.definition'),
            usage: t('dashboard.kpi.net_worth.usage')
        },
        runway: {
            title: t('dashboard.runway'),
            icon: 'fa-shield-heart',
            definition: t('dashboard.kpi.runway.definition'),
            usage: t('dashboard.kpi.runway.usage')
        },
        budget_health: {
            title: t('dashboard.budget_health'),
            icon: 'fa-gauge-high',
            definition: t('dashboard.kpi.budget_health.definition'),
            usage: t('dashboard.kpi.budget_health.usage')
        },
        ffi: {
            title: t('dashboard.kpi.ffi.title'),
            icon: 'fa-crown',
            definition: t('dashboard.kpi.ffi.definition'),
            usage: t('dashboard.kpi.ffi.usage')
        },
        dna: {
            title: t('dashboard.kpi.dna.title'),
            icon: 'fa-dna',
            definition: t('dashboard.kpi.dna.definition'),
            usage: t('dashboard.kpi.dna.usage')
        },
        safe_to_spend: {
            title: t('dashboard.safe_to_spend'),
            icon: 'fa-wallet',
            definition: t('dashboard.kpi.safe_to_spend.definition'),
            usage: t('dashboard.kpi.safe_to_spend.usage')
        },
        balance_sheet: {
            title: t('dashboard.balance_sheet'),
            icon: 'fa-scale-balanced',
            definition: t('dashboard.kpi.balance_sheet.definition'),
            usage: t('dashboard.kpi.balance_sheet.usage')
        }
    };

    const info = defs[kpiKey];
    if (!info) return;

    const modal = document.getElementById('info-modal');
    document.getElementById('info-modal-title').textContent = info.title;
    document.getElementById('info-modal-definition').textContent = info.definition;
    document.getElementById('info-modal-usage').textContent = info.usage;
    
    const iconContainer = document.getElementById('info-modal-icon');
    iconContainer.innerHTML = `<i class="fa-solid ${info.icon} text-xl"></i>`;

    modal.classList.remove('hidden');
};

export const closeInfoModal = () => {
    document.getElementById('info-modal').classList.add('hidden');
};

export const renderStrategicDashboard = () => {
    const container = document.getElementById('strategic-dashboard-content');
    if (!container) return;

    // 1. Rolling 3-Month Scorecard Data
    const d0 = new Date(state.viewDate);
    const d1 = new Date(d0.getFullYear(), d0.getMonth() - 1, 1);
    const d2 = new Date(d0.getFullYear(), d0.getMonth() - 2, 1);

    const m0 = getMonthlyMetrics(d0);
    const m1 = getMonthlyMetrics(d1);
    const m2 = getMonthlyMetrics(d2);
    const scorecard = [m2, m1, m0]; // History left to right

    // 2. Global CFO Metrics (Current Month)
    const balances = state.months[getMonthKey(d0)]?.balances || calculateBalances(d0);
    const totalLiquidity = Object.values(balances).reduce((sum, b) => sum + b, 0);
    const savingsBalance = state.accounts.filter(a => a.isSaving).reduce((sum, a) => sum + (balances[a.id] || 0), 0);
    
    const runwayGoal = state.emergencyFundMultiplier || 3;
    const actualBurnRate = calculateActualBurnRate(d0);
    
    const standardRunway = actualBurnRate > 0 ? (savingsBalance / actualBurnRate) : 0;
    const fixedBurnRate = m0.fixedExpense || (actualBurnRate * 0.7);
    const hardRunway = fixedBurnRate > 0 ? (savingsBalance / fixedBurnRate) : 0;

    // FFI Calculation: (Passive Income / Fixed Expenses) * 100
    const ffiIndex = m0.fixedExpense > 0 ? (m0.passiveIncome / m0.fixedExpense) * 100 : (m0.passiveIncome > 0 ? 100 : 0);

    // 3. Cash Drag Detection
    const operationalBalances = state.accounts
        .filter(acc => !acc.isSaving && !acc.isInvestmentAccount)
        .reduce((sum, acc) => sum + (balances[acc.id] || 0), 0);
    
    const avgExpense = (m0.expense + m1.expense + m2.expense) / 3 || m0.expense;
    const liquidityTarget = avgExpense * 1.5; // Target 1.5 month of average expense on current accounts
    const cashDrag = operationalBalances - liquidityTarget;

    // 4. Net Worth (Latest Snapshots)
    const getLatestSnapshotVal = (entityId, isAsset = true, targetDate = d0) => {
        const dateStr = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).toISOString().split('T')[0];
        const values = isAsset 
            ? state.assetValues.filter(v => v.asset_id === entityId && v.date <= dateStr)
            : state.liabilityValues.filter(v => v.liability_id === entityId && v.date <= dateStr);
        if (values.length === 0) return 0;
        return values.sort((a, b) => new Date(b.date) - new Date(a.date))[0].value;
    };
    const totalAssetsVal = state.assets.reduce((sum, a) => sum + getLatestSnapshotVal(a.id, true), 0);
    const totalLiabilitiesVal = state.liabilities.reduce((sum, l) => sum + getLatestSnapshotVal(l.id, false), 0);
    const netWorth = totalLiquidity + totalAssetsVal - totalLiabilitiesVal;

    // Safe-to-spend logic
    const recurringExpense = (state.records[getMonthKey(d0)]?.items || [])
        .filter(item => !!item.Model && getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);
    
    const actualVariableExpense = (state.records[getMonthKey(d0)]?.items || [])
        .filter(item => !item.Model && getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);

    const safeToSpendTotal = m0.income - recurringExpense;
    const remainingSafeToSpend = safeToSpendTotal - actualVariableExpense;
    const safeToSpendPct = safeToSpendTotal > 0 ? Math.max(0, (remainingSafeToSpend / safeToSpendTotal) * 100) : 0;

    // 70/20/10 Rule Allocation Calculation
    const totalAlloc = m0.income || 1;
    const needsPct = (m0.allocation.needs / totalAlloc) * 100;
    const leisurePct = (m0.allocation.leisure / totalAlloc) * 100;
    const savingsPct = (m0.allocation.savings / totalAlloc) * 100;

    // Render HTML
    container.innerHTML = `
        <div class="space-y-8">
            <!-- Improvement 1: Rolling 3-Month Scorecard -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${scorecard.map((m, idx) => `
                    <div class="bg-white p-5 rounded-2xl border ${idx === 2 ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-100 opacity-60'} flex flex-col justify-between transition-all">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${m.label} ${idx === 2 ? t('dashboard.actual') : ''}</span>
                            <div class="px-2 py-0.5 rounded-full text-[9px] font-bold ${m.savingsRate >= 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}">
                                SR: ${m.savingsRate.toFixed(0)}%
                            </div>
                        </div>
                        <div class="flex items-end justify-between">
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Cash-Flow Net</p>
                                <h3 class="text-xl font-black ${m.income - m.expense >= 0 ? 'text-slate-800' : 'text-rose-600'}">
                                    ${formatCurrency(m.income - m.expense)}
                                </h3>
                            </div>
                            <div class="text-right">
                                <p class="text-[9px] font-bold text-slate-400 uppercase">${t('dashboard.income')}</p>
                                <p class="text-xs font-bold text-emerald-600">${formatCurrency(m.income)}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Improvement 2: Cash Drag Alert -->
            ${cashDrag > 1000 ? `
                <div class="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
                    <div class="w-10 h-10 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid fa-bolt-lightning"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-amber-900 text-sm italic underline decoration-amber-300">${t('dashboard.cash_drag')}</h4>
                        <p class="text-xs text-amber-800 mt-1 leading-relaxed">
                            Vous avez <b>${formatCurrency(cashDrag)}</b> d'excédent stagnant sur vos comptes courants (au-delà de vos besoins de 1.5 mois). 
                            Ce capital "dort" au lieu de travailler. Envisagez un virement vers vos <b>Comptes d'Épargne</b> ou d'investissement.
                        </p>
                    </div>
                </div>
            ` : ''}

            <!-- Strategic KPI Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Net Worth Card -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden hover:border-indigo-300 transition-all hover:shadow-lg group">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                    <div class="flex justify-between items-start relative z-10">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('dashboard.net_worth')}</p>
                            <h2 class="text-4xl font-black text-indigo-600">${formatCurrency(netWorth)}</h2>
                        </div>
                        <button onclick="window.app.openKPIInfo('net_worth')" class="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                    </div>
                    <div onclick="window.app.openWealthEvolution()" class="mt-4 flex items-center justify-between cursor-pointer relative z-10">
                        <span class="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Bilan de Situation</span>
                        <i class="fa-solid fa-chart-line text-indigo-300 group-hover:text-indigo-600 transition-colors"></i>
                    </div>
                </div>

                <!-- Improvement 3: Smart Runway (Based on Burn Rate) -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('dashboard.runway')}</p>
                            <div class="flex items-baseline gap-2">
                                <h2 class="text-4xl font-black ${standardRunway >= runwayGoal ? 'text-emerald-600' : 'text-amber-600'}">${standardRunway.toFixed(1)}</h2>
                                <span class="text-slate-400 font-bold text-xs uppercase">${t('dashboard.months')}</span>
                            </div>
                        </div>
                        <button onclick="window.app.openKPIInfo('runway')" class="p-2 text-slate-300 hover:text-amber-500 transition-colors">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                    </div>
                    <div class="mt-4 space-y-3">
                        <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${Math.min(100, (standardRunway / runwayGoal) * 100)}%"></div>
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-[9px] text-slate-400 font-black uppercase">Cible: ${runwayGoal} ${t('dashboard.months')} (Sécurité)</p>
                            <span class="text-[10px] font-black text-slate-400">Burn: ${formatCurrency(actualBurnRate)}/m</span>
                        </div>
                    </div>
                </div>

                <!-- Santé Budgétaire (70/20/10) -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${t('dashboard.budget_health')} (70/20/10)</p>
                            <div class="flex h-4 w-full rounded-full overflow-hidden mt-2 bg-slate-100">
                                <div class="bg-slate-400 h-full" style="width: ${Math.min(100, needsPct)}%" title="Besoins (70% cible)"></div>
                                <div class="bg-amber-400 h-full" style="width: ${Math.min(100, leisurePct)}%" title="Loisirs (20% cible)"></div>
                                <div class="bg-emerald-400 h-full" style="width: ${Math.min(100, savingsPct)}%" title="Épargne (10% cible)"></div>
                            </div>
                        </div>
                        <button onclick="window.app.openKPIInfo('budget_health')" class="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                    </div>
                    <div class="mt-4 grid grid-cols-3 gap-2">
                        <div class="text-center">
                            <p class="text-[8px] font-black text-slate-400 uppercase">Besoins</p>
                            <p class="text-[10px] font-bold ${needsPct <= 70 ? 'text-slate-600' : 'text-rose-600'}">${needsPct.toFixed(0)}%</p>
                        </div>
                        <div class="text-center">
                            <p class="text-[8px] font-black text-slate-400 uppercase">Loisirs</p>
                            <p class="text-[10px] font-bold ${leisurePct <= 20 ? 'text-slate-600' : 'text-rose-600'}">${leisurePct.toFixed(0)}%</p>
                        </div>
                        <div class="text-center">
                            <p class="text-[8px] font-black text-slate-400 uppercase">Épargne</p>
                            <p class="text-[10px] font-bold ${savingsPct >= 10 ? 'text-emerald-600' : 'text-amber-600'}">${savingsPct.toFixed(0)}%</p>
                        </div>
                    </div>
                </div>

                <!-- Indice de Souveraineté (FFI) -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Souveraineté (FFI)</p>
                            <div class="flex items-baseline gap-2">
                                <h2 class="text-4xl font-black ${ffiIndex >= 100 ? 'text-emerald-600' : 'text-indigo-600'}">${ffiIndex.toFixed(0)}%</h2>
                                <span class="text-slate-400 font-bold text-[10px] uppercase">couverture</span>
                            </div>
                        </div>
                        <button onclick="window.app.openKPIInfo('ffi')" class="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                    </div>
                    <div class="mt-4 space-y-3">
                        <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-emerald-500 h-full transition-all duration-1000" style="width: ${Math.min(100, ffiIndex)}%"></div>
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-[9px] text-slate-400 font-black uppercase">Revenu Passif vs Charges Fixes</p>
                            <span class="text-[10px] font-black text-emerald-600">${formatCurrency(m0.passiveIncome)}</span>
                        </div>
                    </div>
                </div>

                <!-- Revenue DNA Donut -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <div class="flex justify-between items-start">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">${t('dashboard.dna_title')}</p>
                        <button onclick="window.app.openKPIInfo('dna')" class="p-2 text-slate-300 hover:text-emerald-500 transition-colors">
                            <i class="fa-solid fa-circle-info"></i>
                        </button>
                    </div>
                    <div id="revenue-dna-chart" class="w-full h-32"></div>
                    <div class="flex justify-between items-center mt-2 px-2">
                        <div class="flex items-center gap-1.5">
                            <div class="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span class="text-[9px] font-bold text-slate-500">${t('dashboard.dna_active')}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span class="text-[9px] font-bold text-slate-500">${t('dashboard.dna_passive')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detailed Analysis Widgets -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Restant à Vivre -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-xl text-slate-800">${t('dashboard.safe_to_spend')}</h3>
                                <button onclick="window.app.openKPIInfo('safe_to_spend')" class="text-slate-300 hover:text-indigo-500 transition-colors">
                                    <i class="fa-solid fa-circle-info text-sm"></i>
                                </button>
                            </div>
                            <p class="text-sm text-slate-500 italic">Budget disponible après obligations</p>
                        </div>
                        <div class="text-right">
                            <p class="text-3xl font-black ${remainingSafeToSpend >= 0 ? 'text-slate-800' : 'text-rose-600'}">${formatCurrency(remainingSafeToSpend)}</p>
                            <p class="text-xs font-bold text-slate-400 uppercase">sur ${formatCurrency(safeToSpendTotal)}</p>
                        </div>
                    </div>
                    
                    <div class="relative h-6 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div class="absolute inset-y-0 left-0 ${remainingSafeToSpend >= 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-rose-500'} transition-all duration-1000" style="width: ${safeToSpendPct}%"></div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-50">
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">${t('dashboard.income')}</p>
                            <p class="font-bold text-emerald-600">${formatCurrency(m0.income)}</p>
                        </div>
                        <div class="text-center border-x border-slate-100 px-4">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Obligations (Fixes)</p>
                            <p class="font-bold text-slate-700">${formatCurrency(recurringExpense)}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Dépenses Libres</p>
                            <p class="font-bold text-rose-500">${formatCurrency(actualVariableExpense)}</p>
                        </div>
                    </div>
                </div>

                <!-- Balance Sheet Map -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="font-bold text-xl text-slate-800">${t('dashboard.balance_sheet')}</h3>
                        <button onclick="window.app.openKPIInfo('balance_sheet')" class="text-slate-300 hover:text-indigo-500 transition-colors">
                            <i class="fa-solid fa-circle-info text-sm"></i>
                        </button>
                    </div>
                    <div class="flex h-12 w-full rounded-xl overflow-hidden shadow-inner border border-slate-200">
                        <div class="bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000" style="width: ${(netWorth / (netWorth + totalLiabilitiesVal)) * 100}%" title="Capital Net">${t('wealth.net_equity').toUpperCase()}</div>
                        <div class="bg-rose-400 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000" style="width: ${(totalLiabilitiesVal / (netWorth + totalLiabilitiesVal)) * 100}%" title="Dettes">${t('wealth.liabilities_label').split('(')[0].trim().toUpperCase()}</div>
                    </div>
                    <div class="flex justify-between mt-4">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-indigo-500"></div>
                            <span class="text-xs font-bold text-slate-600">${t('common.owned', 'Possédé')} (${((netWorth / (netWorth + totalLiabilitiesVal)) * 100).toFixed(0)}%)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-rose-400"></div>
                            <span class="text-xs font-bold text-slate-600">${t('common.debts', 'Dettes')} (${((totalLiabilitiesVal / (netWorth + totalLiabilitiesVal)) * 100).toFixed(0)}%)</span>
                        </div>
                    </div>
                    <div class="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <p class="text-sm text-indigo-900 font-medium leading-relaxed italic">
                            <i class="fa-solid fa-lightbulb mr-2 text-indigo-400"></i>
                            ${t('dashboard.self_financing_msg', { amount: formatCurrency(m0.income - m0.expense) })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // After injecting HTML, render charts
    setTimeout(() => {
        renderRevenueDNAChart(m0.activeIncome, m0.passiveIncome);
    }, 100);
};

export const renderRevenueDNAChart = (active, passive) => {
    const container = document.getElementById('revenue-dna-chart');
    if (!container) return;

    if (typeof google === 'undefined' || !google.visualization || !google.visualization.arrayToDataTable) {
        if (typeof google !== 'undefined' && google.charts) {
            google.charts.load('current', {packages:['corechart']});
            google.charts.setOnLoadCallback(() => renderRevenueDNAChart(active, passive));
        }
        return;
    }

    const data = google.visualization.arrayToDataTable([
        ['Type', 'Amount'],
        ['Actif', active],
        ['Passif', passive]
    ]);

    const options = {
        pieHole: 0.7,
        legend: 'none',
        pieSliceText: 'none',
        colors: ['#6366f1', '#10b981'],
        chartArea: { width: '90%', height: '90%' },
        backgroundColor: 'transparent',
        enableInteractivity: true,
        tooltip: { trigger: 'selection' }
    };

    const chart = new google.visualization.PieChart(container);
    chart.draw(data, options);
};

export const openWealthEvolution = () => {
    const modal = document.getElementById('wealth-evolution-modal');
    if (modal) modal.classList.remove('hidden');
    renderWealthEvolutionChart();
};

export const renderWealthEvolutionChart = () => {
    const container = document.getElementById('wealth-evolution-chart');
    if (!container) return;

    if (typeof google === 'undefined' || !google.visualization || !google.visualization.DataTable) {
        if (typeof google !== 'undefined' && google.charts) {
            google.charts.load('current', {packages:['corechart']});
            google.charts.setOnLoadCallback(renderWealthEvolutionChart);
        }
        return;
    }

    const start = new Date(state.monthSelectorConfig.startDate);
    const end = new Date(state.monthSelectorConfig.endDate);
    const months = [];
    let curr = new Date(start.getFullYear(), start.getMonth(), 1);
    while (curr <= end) {
        months.push(new Date(curr));
        curr.setMonth(curr.getMonth() + 1);
    }

    const dataRows = months.map(date => {
        const balances = state.months[getMonthKey(date)]?.balances || calculateBalances(date);
        const liquidity = Object.values(balances).reduce((sum, b) => sum + b, 0);

        const lastDayStr = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const assets = state.assets.reduce((sum, a) => {
            const vals = state.assetValues.filter(v => v.asset_id === a.id && v.date <= lastDayStr);
            return sum + (vals.length > 0 ? vals.sort((x, y) => new Date(y.date) - new Date(x.date))[0].value : 0);
        }, 0);

        const liabilities = state.liabilities.reduce((sum, l) => {
            const vals = state.liabilityValues.filter(v => v.liability_id === l.id && v.date <= lastDayStr);
            return sum + (vals.length > 0 ? vals.sort((x, y) => new Date(y.date) - new Date(x.date))[0].value : 0);
        }, 0);

        const net = liquidity + assets - liabilities;
        const label = new Intl.DateTimeFormat('fr-BE', { month: 'short', year: '2-digit' }).format(date);
        
        return [label, net, liquidity, assets, liabilities];
    });

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Mois');
    data.addColumn('number', 'Patrimoine Net');
    data.addColumn('number', 'Liquidités');
    data.addColumn('number', 'Actifs');
    data.addColumn('number', 'Dettes');

    data.addRows(dataRows);

    const options = {
        curveType: 'function',
        legend: { position: 'bottom', textStyle: { fontName: 'Inter', fontSize: 10 } },
        colors: ['#6366f1', '#10b981', '#3b82f6', '#f43f5e'],
        chartArea: { width: '85%', height: '70%' },
        vAxis: { format: 'short', textStyle: { fontName: 'Inter', fontSize: 9 } },
        hAxis: { textStyle: { fontName: 'Inter', fontSize: 9 } },
        lineWidth: 3,
        animation: { startup: true, duration: 1000, easing: 'out' },
        backgroundColor: 'transparent'
    };

    const chart = new google.visualization.LineChart(container);
    chart.draw(data, options);
};
