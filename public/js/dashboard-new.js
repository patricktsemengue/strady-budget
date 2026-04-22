import { state } from './state.js';
import { formatCurrency, getMonthKey, getTxDisplayInfo } from './utils.js';
import { calculateBalances, calculateMonthlyIncome } from './calculations.js';

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

    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
    
    return { 
        income: monthIncome, 
        expense: monthExpense, 
        fixedExpense, 
        savingsRate,
        label: new Intl.DateTimeFormat('fr-BE', { month: 'short' }).format(date)
    };
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
    
    const runwayGoal = state.emergencyFundMultiplier || 3;
    const standardRunway = m0.expense > 0 ? (totalLiquidity / m0.expense) : 0;
    const hardRunway = m0.fixedExpense > 0 ? (totalLiquidity / m0.fixedExpense) : 0;

    // 3. Cash Drag Detection
    const operationalBalances = state.accounts
        .filter(acc => !acc.isSaving && !acc.isInvestmentAccount)
        .reduce((sum, acc) => sum + (balances[acc.id] || 0), 0);
    
    const avgExpense = (m0.expense + m1.expense + m2.expense) / 3 || m0.expense;
    const liquidityTarget = avgExpense * runwayGoal;
    const cashDrag = operationalBalances - liquidityTarget;

    // 4. Net Worth (Latest Snapshots)
    const getLatestSnapshotVal = (entityId, isAsset = true) => {
        const values = isAsset 
            ? state.assetValues.filter(v => v.asset_id === entityId)
            : state.liabilityValues.filter(v => v.liability_id === entityId);
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

    // Render HTML
    container.innerHTML = `
        <div class="space-y-8">
            <!-- Improvement 1: Rolling 3-Month Scorecard -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${scorecard.map((m, idx) => `
                    <div class="bg-white p-5 rounded-2xl border ${idx === 2 ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-100 opacity-60'} flex flex-col justify-between transition-all">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${m.label} ${idx === 2 ? '(Actuel)' : ''}</span>
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
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Revenus</p>
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
                        <h4 class="font-bold text-amber-900 text-sm italic underline decoration-amber-300">Opportunité CFO : Cash Drag détecté</h4>
                        <p class="text-xs text-amber-800 mt-1 leading-relaxed">
                            Vous avez <b>${formatCurrency(cashDrag)}</b> d'excédent stagnant sur vos comptes courants (au-delà de votre objectif de ${runwayGoal} mois). 
                            Ce capital "dort" au lieu de travailler. Envisagez un virement vers vos <b>Portefeuilles d'Investissement</b>.
                        </p>
                    </div>
                </div>
            ` : ''}

            <!-- Strategic KPI Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Net Worth Card -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50"></div>
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patrimoine Net Total</p>
                        <h2 class="text-4xl font-black text-indigo-600">${formatCurrency(netWorth)}</h2>
                    </div>
                    <div class="mt-4 flex items-center gap-2">
                        <span class="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">Bilan de Situation</span>
                    </div>
                </div>

                <!-- Improvement 3: Dynamic Burn Rate / Runways -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Autonomie (Runway)</p>
                        <div class="flex items-baseline gap-2">
                            <h2 class="text-4xl font-black ${standardRunway >= runwayGoal ? 'text-emerald-600' : 'text-amber-600'}">${standardRunway.toFixed(1)}</h2>
                            <span class="text-slate-400 font-bold text-xs uppercase">mois</span>
                        </div>
                    </div>
                    <div class="mt-4 space-y-3">
                        <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-amber-500 h-full transition-all duration-1000" style="width: ${Math.min(100, (standardRunway / runwayGoal) * 100)}%"></div>
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-[9px] text-slate-400 font-black uppercase">Mode Survie (Dépenses Fixes)</p>
                            <span class="text-[10px] font-black text-indigo-600">${hardRunway.toFixed(1)} mois</span>
                        </div>
                    </div>
                </div>

                <!-- Safe-to-Spend Percentage -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efficacité Budgétaire</p>
                        <h2 class="text-4xl font-black text-slate-800">${safeToSpendPct.toFixed(0)}%</h2>
                    </div>
                    <div class="mt-4">
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="bg-indigo-500 h-full transition-all duration-1000" style="width: ${safeToSpendPct}%"></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Discrétionnaire restant</p>
                    </div>
                </div>
            </div>

            <!-- Detailed Analysis Widgets -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Restant à Vivre -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <h3 class="font-bold text-xl text-slate-800">Restant à Vivre</h3>
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
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Entrées</p>
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
                    <h3 class="font-bold text-xl text-slate-800 mb-6">Structure du Bilan</h3>
                    <div class="flex h-12 w-full rounded-xl overflow-hidden shadow-inner border border-slate-200">
                        <div class="bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000" style="width: ${(netWorth / (netWorth + totalLiabilitiesVal)) * 100}%" title="Capital Net">PATRIMOINE NET</div>
                        <div class="bg-rose-400 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000" style="width: ${(totalLiabilitiesVal / (netWorth + totalLiabilitiesVal)) * 100}%" title="Dettes">DETTES</div>
                    </div>
                    <div class="flex justify-between mt-4">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-indigo-500"></div>
                            <span class="text-xs font-bold text-slate-600">Possédé (${((netWorth / (netWorth + totalLiabilitiesVal)) * 100).toFixed(0)}%)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-rose-400"></div>
                            <span class="text-xs font-bold text-slate-600">Dettes (${((totalLiabilitiesVal / (netWorth + totalLiabilitiesVal)) * 100).toFixed(0)}%)</span>
                        </div>
                    </div>
                    <div class="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <p class="text-sm text-indigo-900 font-medium leading-relaxed italic">
                            <i class="fa-solid fa-lightbulb mr-2 text-indigo-400"></i>
                            Votre capacité d'autofinancement mensuelle est de <b>${formatCurrency(m0.income - m0.expense)}</b>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
};
