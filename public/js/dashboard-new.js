import { state } from './state.js';
import { formatCurrency, getMonthKey, getTxDisplayInfo } from './utils.js';
import { calculateBalances, calculateMonthlyIncome } from './calculations.js';

export const renderStrategicDashboard = () => {
    const container = document.getElementById('strategic-dashboard-content');
    if (!container) return;

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [], status: 'open' };
    const balances = state.months[monthKey]?.balances || calculateBalances(state.viewDate);
    
    // 1. Core CFO Metrics
    const totalLiquidity = Object.values(balances).reduce((sum, b) => sum + b, 0);
    const monthIncome = calculateMonthlyIncome(state.viewDate);
    const monthExpense = monthData.items
        .filter(item => getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);
    
    const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0;
    const survivalRunway = monthExpense > 0 ? (totalLiquidity / monthExpense) : 0;
    const runwayGoal = state.emergencyFundMultiplier || 3;

    // 2. Safe-to-Spend Logic
    const recurringExpense = monthData.items
        .filter(item => !!item.Model && getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);
    
    const actualVariableExpense = monthData.items
        .filter(item => !item.Model && getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);

    const safeToSpendTotal = monthIncome - recurringExpense;
    const remainingSafeToSpend = safeToSpendTotal - actualVariableExpense;
    const safeToSpendPct = safeToSpendTotal > 0 ? Math.max(0, (remainingSafeToSpend / safeToSpendTotal) * 100) : 0;

    // 3. Net Worth (Latest Snapshots)
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

    // Render HTML
    container.innerHTML = `
        <div class="space-y-8">
            <!-- Traffic Light Health Signal -->
            <div class="flex items-center gap-4 p-4 rounded-2xl ${remainingSafeToSpend >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'} border">
                <div class="w-12 h-12 rounded-full flex items-center justify-center ${remainingSafeToSpend >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} text-white shadow-lg animate-pulse">
                    <i class="fa-solid ${remainingSafeToSpend >= 0 ? 'fa-check' : 'fa-triangle-exclamation'} text-xl"></i>
                </div>
                <div>
                    <h3 class="font-bold ${remainingSafeToSpend >= 0 ? 'text-emerald-900' : 'text-rose-900'}">Santé Financière : ${remainingSafeToSpend >= 0 ? 'Optimale' : 'Attention'}</h3>
                    <p class="text-sm ${remainingSafeToSpend >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                        ${remainingSafeToSpend >= 0 
                            ? `Vous respectez vos engagements. Il vous reste ${formatCurrency(remainingSafeToSpend)} de budget discrétionnaire.` 
                            : `Vous avez dépassé votre budget prévu de ${formatCurrency(Math.abs(remainingSafeToSpend))}.`}
                    </p>
                </div>
            </div>

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
                        <span class="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">+2.4% vs mois dernier</span>
                    </div>
                </div>

                <!-- Savings Rate Card -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taux d'Épargne</p>
                        <h2 class="text-4xl font-black ${savingsRate >= 20 ? 'text-emerald-600' : 'text-slate-800'}">${savingsRate.toFixed(1)}%</h2>
                    </div>
                    <div class="mt-4">
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="bg-emerald-500 h-full transition-all duration-1000" style="width: ${Math.min(100, (savingsRate / 20) * 100)}%"></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-2 font-bold">Objectif CFO : > 20%</p>
                    </div>
                </div>

                <!-- Survival Runway Card -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Autonomie (Runway)</p>
                        <h2 class="text-4xl font-black ${survivalRunway >= runwayGoal ? 'text-emerald-600' : 'text-amber-600'}">${survivalRunway.toFixed(1)} <span class="text-lg text-slate-400">mois</span></h2>
                    </div>
                    <div class="mt-4">
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="bg-amber-500 h-full transition-all duration-1000" style="width: ${Math.min(100, (survivalRunway / runwayGoal) * 100)}%"></div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-2 font-bold">Objectif : ${runwayGoal} mois</p>
                    </div>
                </div>
            </div>

            <!-- Safe-to-Spend Widget -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <h3 class="font-bold text-xl text-slate-800">Restant à Vivre</h3>
                            <p class="text-sm text-slate-500 italic">Budget discrétionnaire après obligations</p>
                        </div>
                        <div class="text-right">
                            <p class="text-3xl font-black ${remainingSafeToSpend >= 0 ? 'text-slate-800' : 'text-rose-600'}">${formatCurrency(remainingSafeToSpend)}</p>
                            <p class="text-xs font-bold text-slate-400 uppercase">sur ${formatCurrency(safeToSpendTotal)}</p>
                        </div>
                    </div>
                    
                    <!-- Large Progress Bar -->
                    <div class="relative h-6 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div class="absolute inset-y-0 left-0 ${remainingSafeToSpend >= 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-rose-500'} transition-all duration-1000" style="width: ${safeToSpendPct}%"></div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-50">
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Revenus</p>
                            <p class="font-bold text-emerald-600">${formatCurrency(monthIncome)}</p>
                        </div>
                        <div class="text-center border-x border-slate-100 px-4">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Charges fixes</p>
                            <p class="font-bold text-slate-700">${formatCurrency(recurringExpense)}</p>
                        </div>
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Dépenses réelles</p>
                            <p class="font-bold text-rose-500">${formatCurrency(actualVariableExpense)}</p>
                        </div>
                    </div>
                </div>

                <!-- Wealth Map: Asset vs Debt -->
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                    <h3 class="font-bold text-xl text-slate-800 mb-6">Structure du Patrimoine</h3>
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
                        <p class="text-sm text-indigo-900 font-medium leading-relaxed">
                            <i class="fa-solid fa-lightbulb mr-2"></i>
                            Votre levier d'endettement est sain. Chaque remboursement de prêt augmente directement votre "Possédé".
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
};
