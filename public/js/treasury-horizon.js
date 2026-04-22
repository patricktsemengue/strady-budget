import { state } from './state.js';
import { formatCurrency, getMonthKey } from './utils.js';
import { calculateBalances } from './calculations.js';

export const renderTreasuryHorizon = () => {
    const container = document.getElementById('treasury-horizon-container');
    if (!container) return;

    const windowSize = 4; // Show 4 months
    const months = [];
    const startDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1);

    for (let i = 0; i < windowSize; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push({
            key: getMonthKey(d),
            date: d,
            label: new Intl.DateTimeFormat('fr-BE', { month: 'short', year: '2-digit' }).format(d)
        });
    }

    // Pre-calculate balances for all months in the window
    const monthlyBalances = months.map(m => calculateBalances(m.date));

    // Grouping Logic
    const groupDefinitions = [
        { label: 'FLUX COURANTS', icon: 'fa-wallet', filter: acc => !acc.isSaving && !acc.isInvestmentAccount },
        { label: 'ÉPARGNE DE PRÉCAUTION', icon: 'fa-piggy-bank', filter: acc => acc.isSaving },
        { label: 'PORTEFEUILLES D\'INVEST.', icon: 'fa-money-bill-trend-up', filter: acc => acc.isInvestmentAccount }
    ];

    let html = `
        <div class="space-y-10">
    `;

    groupDefinitions.forEach(group => {
        const groupAccounts = state.accounts.filter(group.filter);
        if (groupAccounts.length === 0) return;

        html += `
            <div class="excel-grid-container overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <i class="fa-solid ${group.icon}"></i>
                    </div>
                    <h3 class="text-xs font-black text-slate-700 uppercase tracking-widest">${group.label}</h3>
                </div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse table-fixed min-w-[800px]">
                        <thead>
                            <tr class="bg-slate-50/50 border-b border-slate-100">
                                <th class="sticky left-0 z-20 bg-slate-50 px-6 py-4 w-64 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">Compte</th>
                                ${months.map(m => `
                                    <th class="px-4 py-4 text-center border-r border-slate-100 last:border-r-0">
                                        <span class="block text-xs font-black text-slate-800 uppercase">${m.label}</span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
        `;

        groupAccounts.forEach(acc => {
            html += `
                <tr class="hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-b-0">
                    <td class="sticky left-0 z-10 bg-white hover:bg-indigo-50/30 px-6 py-4 border-r border-slate-200 text-xs text-slate-700 font-bold truncate shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                        ${acc.name}
                    </td>
                    ${months.map((m, idx) => {
                        const balance = monthlyBalances[idx][acc.id] || 0;
                        let variationHtml = '';
                        
                        if (idx > 0) {
                            const prevBalance = monthlyBalances[idx-1][acc.id] || 0;
                            const diff = balance - prevBalance;
                            if (diff !== 0) {
                                const colorClass = diff > 0 ? 'text-emerald-500' : 'text-rose-500';
                                const icon = diff > 0 ? 'fa-caret-up' : 'fa-caret-down';
                                variationHtml = `<span class="block text-[9px] font-bold ${colorClass} mt-0.5"><i class="fa-solid ${icon}"></i> ${formatCurrency(Math.abs(diff))}</span>`;
                            }
                        }

                        return `
                            <td class="px-4 py-4 text-right border-r border-slate-100 last:border-r-0">
                                <span class="text-xs font-black text-slate-800">${formatCurrency(balance)}</span>
                                ${variationHtml}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        });

        // Group Total Row
        html += `
                        </tbody>
                        <tfoot>
                            <tr class="bg-slate-50/80 border-t border-slate-200">
                                <td class="sticky left-0 z-10 bg-slate-50/90 px-6 py-4 border-r border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total ${group.label}</td>
                                ${months.map((m, idx) => {
                                    const groupTotal = groupAccounts.reduce((sum, acc) => sum + (monthlyBalances[idx][acc.id] || 0), 0);
                                    return `
                                        <td class="px-4 py-4 text-right border-r border-slate-100 last:border-r-0">
                                            <span class="text-sm font-black text-slate-900">${formatCurrency(groupTotal)}</span>
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    });

    html += `
        </div>
    `;

    container.innerHTML = html;
};
