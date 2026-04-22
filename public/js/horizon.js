import { state } from './state.js';
import { formatCurrency, getMonthKey, getTxDisplayInfo } from './utils.js';

export const toggleHorizonCategory = (catId) => {
    const expandedStates = JSON.parse(localStorage.getItem('strady_horizon_expanded') || '{}');
    expandedStates[catId] = !expandedStates[catId];
    localStorage.setItem('strady_horizon_expanded', JSON.stringify(expandedStates));
    renderHorizon();
};

export const toggleAllHorizonCategories = (expand) => {
    const expandedStates = {};
    if (expand) {
        state.categories.forEach(cat => {
            expandedStates[cat.id] = true;
        });
    }
    localStorage.setItem('strady_horizon_expanded', JSON.stringify(expandedStates));
    renderHorizon();
};

export const setHorizonNatureFilter = (nature) => {
    localStorage.setItem('strady_horizon_nature_filter', nature);
    renderHorizon();
};

// Helper to get default priority based on nature
const getNaturePriority = (nature) => {
    switch (nature) {
        case 'REVENU': return 1;
        case 'FIXE': return 2;
        case 'QUOTIDIEN': return 3;
        case 'LOISIR': return 4;
        case 'EPARGNE': return 5;
        default: return 6;
    }
};

export const renderHorizon = () => {
    const container = document.getElementById('horizon-view-container');
    if (!container) return;

    // 0. Get Filters
    const catFilter = document.getElementById('filter-category-horizon')?.value || 'all';
    const accFilter = document.getElementById('filter-account-horizon')?.value || 'all';
    const natureFilter = localStorage.getItem('strady_horizon_nature_filter') || 'ALL';

    // Update Pills visual state
    document.querySelectorAll('.nature-pill-horizon').forEach(pill => {
        const onclick = pill.getAttribute('onclick');
        if (onclick && onclick.includes(`'${natureFilter}'`)) {
            pill.classList.add('active', 'bg-slate-800', 'text-white');
            pill.classList.remove('bg-white', 'text-slate-500', 'border');
        } else {
            pill.classList.remove('active', 'bg-slate-800', 'text-white');
            pill.classList.add('bg-white', 'text-slate-500', 'border');
        }
    });

    const windowSize = 4;
    const months = [];
    const startDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1);

    for (let i = 0; i < windowSize; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push({
            key: getMonthKey(d),
            label: new Intl.DateTimeFormat('fr-BE', { month: 'short', year: '2-digit' }).format(d)
        });
    }

    const expandedStates = JSON.parse(localStorage.getItem('strady_horizon_expanded') || '{}');
    const categoryMap = {};
    const monthlyNetTotals = {}; // { monthKey: { in: 0, out: 0 } }
    
    // 1. Filter and Sort Categories by Priority
    state.categories
        .filter(cat => {
            const matchesCat = catFilter === 'all' || cat.id === catFilter;
            const matchesNature = natureFilter === 'ALL' || cat.nature === natureFilter;
            return matchesCat && matchesNature;
        })
        .sort((a, b) => {
            // First by explicit index-order if it exists
            const orderA = a['index-order'] ?? (getNaturePriority(a.nature) * 100);
            const orderB = b['index-order'] ?? (getNaturePriority(b.nature) * 100);
            
            if (orderA !== orderB) return orderA - orderB;
            
            // Then by label as fallback
            return a.label.localeCompare(b.label);
        })
        .forEach(cat => {
            categoryMap[cat.id] = {
                info: cat,
                labels: {}, 
                totals: {}  
            };
        });

    // 2. Populate data across months
    months.forEach(month => {
        monthlyNetTotals[month.key] = { in: 0, out: 0 };
        const monthData = state.records[month.key] || { items: [] };
        monthData.items.forEach(item => {
            const catId = item.Category || 'uncategorized';
            
            // Apply Account Filter (Global for the bar too)
            if (accFilter !== 'all') {
                if (item.source !== accFilter && item.destination !== accFilter) return;
            }

            const txInfo = getTxDisplayInfo(item.source, item.destination);
            
            // Update Monthly Totals for the Sticky Bar
            if (txInfo.isIncome) monthlyNetTotals[month.key].in += item.amount;
            else if (txInfo.isExpense) monthlyNetTotals[month.key].out += item.amount;

            // Only update category map if it passed the filters
            if (!categoryMap[catId]) return;

            const amount = txInfo.isIncome ? item.amount : (txInfo.isExpense ? -item.amount : 0);

            if (!categoryMap[catId].labels[item.label]) {
                categoryMap[catId].labels[item.label] = {};
            }
            categoryMap[catId].labels[item.label][month.key] = (categoryMap[catId].labels[item.label][month.key] || 0) + amount;
            categoryMap[catId].totals[month.key] = (categoryMap[catId].totals[month.key] || 0) + amount;
        });
    });

    // 3. Render HTML Grid
    let html = `
        <div class="excel-grid-container overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse table-fixed min-w-[800px]">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-200">
                            <th class="sticky left-0 z-20 bg-slate-50 px-6 py-4 w-64 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">Postes / Flux</th>
                            ${months.map(m => `
                                <th class="px-4 py-4 text-center border-r border-slate-100 last:border-r-0">
                                    <span class="block text-xs font-black text-slate-800 uppercase">${m.label}</span>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Important: Use the same order as in step 1 by iterating over the filtered categories
    state.categories
        .filter(cat => !!categoryMap[cat.id]) // Only those that passed the filter
        .sort((a, b) => {
            const orderA = a['index-order'] ?? (getNaturePriority(a.nature) * 100);
            const orderB = b['index-order'] ?? (getNaturePriority(b.nature) * 100);
            if (orderA !== orderB) return orderA - orderB;
            return a.label.localeCompare(b.label);
        })
        .forEach(cat => {
            const catGroup = categoryMap[cat.id];
            const isExpanded = !!expandedStates[cat.id];
            const hasData = Object.keys(catGroup.totals).length > 0;
            
            if (!hasData) return;

            // Category Header Row
            html += `
                <tr class="bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors" onclick="window.app.toggleHorizonCategory('${cat.id}')">
                    <td class="sticky left-0 z-10 bg-slate-50/90 backdrop-blur-sm px-6 py-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}"></i>
                            <div class="w-5 h-5 rounded flex items-center justify-center text-white text-[10px]" style="background-color: ${cat.color}">
                                <i class="fa-solid ${cat.icon}"></i>
                            </div>
                            <span class="text-xs font-black text-slate-700 uppercase tracking-wider">${cat.label}</span>
                        </div>
                    </td>
                    ${months.map(m => {
                        const total = catGroup.totals[m.key] || 0;
                        return `<td class="px-4 py-3 text-right font-black text-xs text-slate-800 border-r border-slate-100 last:border-r-0">${formatCurrency(total)}</td>`;
                    }).join('')}
                </tr>
            `;

            if (isExpanded) {
                Object.keys(catGroup.labels).sort().forEach(label => {
                    html += `
                        <tr class="hover:bg-indigo-50/30 transition-colors border-b border-slate-50">
                            <td class="sticky left-0 z-10 bg-white px-6 py-3 border-r border-slate-200 text-xs text-slate-600 font-medium truncate shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                                <span class="pl-8">${label}</span>
                            </td>
                            ${months.map((m, idx) => {
                                const amount = catGroup.labels[label][m.key] || 0;
                                let variationHtml = '';
                                if (idx > 0) {
                                    const prevAmount = catGroup.labels[label][months[idx-1].key] || 0;
                                    const diff = amount - prevAmount;
                                    if (diff !== 0) {
                                        const colorClass = diff > 0 ? 'text-emerald-500' : 'text-rose-500';
                                        const icon = diff > 0 ? 'fa-caret-up' : 'fa-caret-down';
                                        variationHtml = `<span class="block text-[9px] font-bold ${colorClass} mt-0.5"><i class="fa-solid ${icon}"></i> ${formatCurrency(Math.abs(diff))}</span>`;
                                    }
                                }
                                return `
                                    <td class="px-4 py-3 text-right border-r border-slate-100 last:border-r-0">
                                        <span class="text-xs font-bold text-slate-700">${amount !== 0 ? formatCurrency(amount) : '<span class="text-slate-200">-</span>'}</span>
                                        ${variationHtml}
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    `;
                });
            }
        });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
        <div class="mt-4 flex gap-4 overflow-x-auto pb-2 px-2">
            <div class="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <div class="w-2 h-2 rounded-full bg-emerald-500"></div> Augmentation
            </div>
            <div class="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <div class="w-2 h-2 rounded-full bg-rose-500"></div> Diminution
            </div>
        </div>
    `;

    container.innerHTML = html;

    // 4. Render Sticky Bar Content
    const stickyBar = document.getElementById('horizon-net-sticky-bar');
    const stickyContent = document.getElementById('horizon-net-bar-content');
    
    if (stickyBar && stickyContent) {
        const barHtml = months.map(m => {
            const totals = monthlyNetTotals[m.key];
            const net = totals.in - totals.out;
            return `
                <div class="flex items-center gap-4 py-1 border-r border-white/10 last:border-r-0 pr-8">
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black text-slate-500 uppercase tracking-tighter">${m.label}</span>
                        <div class="flex items-center gap-3">
                            <div>
                                <p class="text-[9px] font-bold text-emerald-400 leading-none">${formatCurrency(totals.in)}</p>
                                <p class="text-[9px] font-bold text-rose-400 leading-none mt-0.5">${formatCurrency(totals.out)}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs font-black italic ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${(net >= 0 ? '+' : '') + formatCurrency(net)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        stickyContent.innerHTML = barHtml;
        stickyBar.classList.remove('hidden');
    }
};
