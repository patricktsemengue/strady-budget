import { state } from './state.js';
import { formatCurrency, formatDateStr, getMonthKey, getTxDisplayInfo } from './utils.js';
import { calculateBalances, calculateMonthlyIncome } from './calculations.js';
import { currentUserId } from './storage.js';
import { updateMonthStatus, updateAccountInFirestore } from './firestore-service.js';
import { showNotification } from './ui.js';
import { router } from './app-router.js';

export const renderTransactions = () => {
    const container = document.getElementById('transactions-container');
    const tableBody = document.getElementById('transactions-table-body');
    
    if (!container && !tableBody) return;

    // 1. Filtering Logic
    const natureFilter = localStorage.getItem('strady_nature_filter') || 'ALL';
    const searchFilter = (document.getElementById('search-transactions')?.value || '').toLowerCase();
    const sortOrder = document.getElementById('sort-order')?.value || document.getElementById('sort-order-mobile')?.value || 'default';

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [], status: 'open' };
    
    // Previous Month Data for Variance
    const prevDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - 1, 1);
    const prevMonthKey = getMonthKey(prevDate);
    const prevMonthItems = state.records[prevMonthKey]?.items || [];
    const prevTotals = {};
    prevMonthItems.forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        const amount = txInfo.isIncome ? item.amount : (txInfo.isExpense ? -item.amount : 0);
        prevTotals[item.Category] = (prevTotals[item.Category] || 0) + amount;
    });

    let filteredItems = [...monthData.items];

    // Nature Filter
    if (natureFilter !== 'ALL') {
        filteredItems = filteredItems.filter(item => {
            const cat = state.categories.find(c => c.id === item.Category);
            return cat && cat.nature === natureFilter;
        });
    }

    // Search Filter
    if (searchFilter) {
        filteredItems = filteredItems.filter(item => {
            const category = state.categories.find(c => c.id === item.Category);
            const categoryLabel = category ? category.label.toLowerCase() : '';
            return item.label.toLowerCase().includes(searchFilter) || categoryLabel.includes(searchFilter);
        });
    }

    // 2. Net Cash Flow Calculation (Real-time for filtered view)
    let totalIn = 0;
    let totalOut = 0;
    filteredItems.forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        if (txInfo.isIncome) totalIn += item.amount;
        else if (txInfo.isExpense) totalOut += item.amount;
    });

    const netBarIn = document.getElementById('net-bar-in');
    const netBarOut = document.getElementById('net-bar-out');
    const netBarTotal = document.getElementById('net-bar-total');
    if (netBarIn) netBarIn.textContent = formatCurrency(totalIn);
    if (netBarOut) netBarOut.textContent = formatCurrency(totalOut);
    if (netBarTotal) {
        const net = totalIn - totalOut;
        netBarTotal.textContent = (net >= 0 ? '+' : '') + formatCurrency(net);
        netBarTotal.className = `text-lg font-black italic ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // Update Nature Filter Pills active state
    document.querySelectorAll('.nature-pill').forEach(pill => {
        const onclick = pill.getAttribute('onclick');
        if (onclick && onclick.includes(`'${natureFilter}'`)) {
            pill.classList.add('active', 'bg-slate-800', 'text-white');
            pill.classList.remove('bg-white', 'text-slate-500', 'border');
        } else {
            pill.classList.remove('active', 'bg-slate-800', 'text-white');
            pill.classList.add('bg-white', 'text-slate-500', 'border');
        }
    });

    // 3. Grouping & Today Logic
    const groups = {};
    filteredItems.forEach(item => {
        const catId = item.Category || 'uncategorized';
        if (!groups[catId]) groups[catId] = { items: [], total: 0 };
        groups[catId].items.push(item);
        
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        const amount = txInfo.isIncome ? item.amount : (txInfo.isExpense ? -item.amount : 0);
        groups[catId].total += amount;
    });

    const expandedStates = JSON.parse(localStorage.getItem('strady_expanded_categories') || '{}');
    const sortedGroupIds = Object.keys(groups).sort((a, b) => {
        const catA = state.categories.find(c => c.id === a);
        const catB = state.categories.find(c => c.id === b);
        const orderA = catA ? (catA['index-order'] ?? 999) : 999;
        const orderB = catB ? (catB['index-order'] ?? 999) : 999;
        return orderA - orderB;
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const isCurrentMonth = state.viewDate.getMonth() === new Date().getMonth() && state.viewDate.getFullYear() === new Date().getFullYear();

    const sortSubItems = (items) => {
        return items.sort((a, b) => {
            if (sortOrder === 'default' || sortOrder === 'date-desc') {
                return new Date(b.date) - new Date(a.date);
            }
            switch (sortOrder) {
                case 'account': return (a.source || '').localeCompare(b.source || '');
                case 'amount-desc': return b.amount - a.amount;
                default: return new Date(b.date) - new Date(a.date);
            }
        });
    };

    const renderVariance = (catId, currentTotal) => {
        const prevTotal = prevTotals[catId] || 0;
        if (prevTotal === 0 && currentTotal === 0) return '';
        const diff = currentTotal - prevTotal;
        const colorClass = diff > 0 ? 'text-green-600' : (diff < 0 ? 'text-rose-600' : 'text-slate-400');
        const icon = diff > 0 ? 'fa-arrow-trend-up' : (diff < 0 ? 'fa-arrow-trend-down' : 'fa-minus');
        return `<span class="text-[10px] font-bold ${colorClass} flex items-center gap-1 ml-2"><i class="fa-solid ${icon}"></i> ${formatCurrency(Math.abs(diff))}</span>`;
    };

    // Render Logic
    if (container) {
        let html = '';
        sortedGroupIds.forEach(catId => {
            const group = groups[catId];
            const category = state.categories.find(c => c.id === catId);
            const isExpanded = !!expandedStates[catId];
            
            const subItems = sortSubItems(group.items);
            let itemsHtml = '';
            let todayInserted = false;

            subItems.forEach((item, idx) => {
                // Insert TODAY line for mobile
                if (isCurrentMonth && !todayInserted && item.date <= todayStr) {
                    if (item.date < todayStr || (idx === 0 && item.date === todayStr)) {
                        itemsHtml += `<li class="today-marker-mobile bg-indigo-600 text-white text-[9px] font-black uppercase py-1 text-center tracking-tighter">AUJOURD'HUI</li>`;
                        todayInserted = true;
                    }
                }

                const txInfo = getTxDisplayInfo(item.source, item.destination);
                const isFuture = item.date > todayStr;

                itemsHtml += `
                    <li class="p-4 flex items-center justify-between gap-4 group transition-all ${isFuture ? 'opacity-60 grayscale-[0.5]' : ''}">
                        <div class="flex items-center gap-4 flex-grow truncate pl-4">
                            <div class="flex-1 truncate">
                                <p class="font-semibold text-slate-800 truncate">${item.label}</p>
                                <p class="text-[10px] text-slate-400 font-medium truncate uppercase">${txInfo.src.name} → ${txInfo.dst.name}</p>
                            </div>
                        </div>
                        <div class="text-right whitespace-nowrap">
                            <p class="font-bold ${txInfo.ui.color}">${formatCurrency(item.amount)}</p>
                            <p class="text-[9px] text-slate-400 font-bold uppercase">${formatDateStr(item.date)}</p>
                        </div>
                    </li>`;
            });

            html += `
                <div class="category-group">
                    <div class="category-group-header flex items-center justify-between p-3 bg-slate-50 border-y border-slate-100 cursor-pointer" onclick="window.app.toggleCategoryGroup('${catId}')">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform chevron ${isExpanded ? 'rotate-180' : ''}"></i>
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px]" style="background-color: ${category?.color || '#94a3b8'}"><i class="fa-solid ${category?.icon || 'fa-tag'}"></i></div>
                            <span class="text-sm font-bold text-slate-700">${category?.label || 'Sans catégorie'}</span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-sm font-black text-slate-700">${formatCurrency(group.total)}</span>
                            ${renderVariance(catId, group.total)}
                        </div>
                    </div>
                    <ul class="divide-y divide-slate-50 ${isExpanded ? '' : 'hidden'}">${itemsHtml}</ul>
                </div>`;
        });
        container.innerHTML = html || '<div class="p-20 text-center text-slate-400 italic">Aucun flux trouvé</div>';
    }

    if (tableBody) {
        let html = '';
        sortedGroupIds.forEach(catId => {
            const group = groups[catId];
            const category = state.categories.find(c => c.id === catId);
            const isExpanded = !!expandedStates[catId];
            const subItems = sortSubItems(group.items);

            let todayInserted = false;
            let groupHtml = `
                <tr class="bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors" onclick="window.app.toggleCategoryGroup('${catId}')">
                    <td colspan="5" class="px-6 py-3 border-y border-slate-100">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <i class="fa-solid fa-chevron-down text-xs text-slate-400 transition-transform chevron ${isExpanded ? '' : 'rotate-[-90deg]'}"></i>
                                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white" style="background-color: ${category?.color || '#94a3b8'}"><i class="fa-solid ${category?.icon || 'fa-tag'}"></i></div>
                                <span class="font-bold text-slate-800">${category?.label || 'Sans catégorie'}</span>
                            </div>
                            <div class="flex items-center gap-6">
                                ${renderVariance(catId, group.total)}
                                <span class="text-lg font-black text-slate-700">${formatCurrency(group.total)}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            subItems.forEach((item, idx) => {
                // TODAY marker for Desktop
                if (isCurrentMonth && !todayInserted && item.date <= todayStr) {
                    if (item.date < todayStr || (idx === 0 && item.date === todayStr)) {
                        groupHtml += `<tr class="${isExpanded ? '' : 'hidden'} today-row-desktop"><td colspan="5" class="bg-indigo-600 text-[10px] font-black text-white py-1 px-6 tracking-widest text-center">AUJOURD'HUI</td></tr>`;
                        todayInserted = true;
                    }
                }

                const txInfo = getTxDisplayInfo(item.source, item.destination);
                const isFuture = item.date > todayStr;

                groupHtml += `
                    <tr class="group hover:bg-slate-50/50 transition-colors ${isExpanded ? '' : 'hidden'} ${isFuture ? 'opacity-60' : ''} border-l-4" style="border-left-color: ${category?.color || '#cbd5e1'}">
                        <td class="px-6 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">${formatDateStr(item.date)}</td>
                        <td class="px-6 py-4">
                            <span class="text-[10px] font-black px-2 py-1 rounded-full ${txInfo.ui.color} bg-white border border-current">${txInfo.isIncome ? 'REVENU' : 'DÉPENSE'}</span>
                        </td>
                        <td class="px-6 py-4 text-right">
                            <span class="font-black ${txInfo.ui.color}">${formatCurrency(item.amount)}</span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="font-bold text-slate-800 text-sm">${item.label}</div>
                            <div class="text-[10px] text-slate-400 font-medium uppercase">${txInfo.src.name} → ${txInfo.dst.name}</div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.app.editTransaction('${item.id}')" class="p-2 text-slate-300 hover:text-blue-600"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="window.app.deleteTransaction('${item.id}')" class="p-2 text-slate-300 hover:text-rose-600"><i class="fa-solid fa-trash text-xs"></i></button>
                            </div>
                        </td>
                    </tr>`;
            });

            html += groupHtml;
        });
        tableBody.innerHTML = html || '<tr><td colspan="5" class="p-20 text-center text-slate-400 italic">Aucun flux trouvé</td></tr>';
    }
};

export const setNatureFilter = (nature) => {
    localStorage.setItem('strady_nature_filter', nature);
    renderTransactions();
};

export const toggleCategoryGroup = (catId) => {
    const expandedStates = JSON.parse(localStorage.getItem('strady_expanded_categories') || '{}');
    expandedStates[catId] = !expandedStates[catId];
    localStorage.setItem('strady_expanded_categories', JSON.stringify(expandedStates));
    renderTransactions();
};

export const toggleAllCategoryGroups = (expand) => {
    const groups = {};
    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };
    
    monthData.items.forEach(item => {
        const catId = item.Category || 'uncategorized';
        groups[catId] = expand;
    });

    localStorage.setItem('strady_expanded_categories', JSON.stringify(groups));
    renderTransactions();
};

export const renderTimeline = () => {
    const container = document.getElementById('month-timeline');
    if (!container) return;

    const config = state.monthSelectorConfig;
    const startDate = new Date(config.startDate + 'T00:00:00Z');
    const endDate = new Date(config.endDate + 'T23:59:59Z');
    const step = config.step;

    let html = '';
    let current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    let lastYear = null;

    while (current <= endDate) {
        const year = current.getUTCFullYear();

        // Add Year Separator
        if (lastYear !== null && year !== lastYear) {
            html += `<div class="w-px h-6 bg-slate-200 mx-2 self-center"></div>`;
        }
        lastYear = year;

        const isSelected = (step === 'month')
            ? (current.getUTCMonth() === state.viewDate.getUTCMonth() && current.getUTCFullYear() === state.viewDate.getUTCFullYear())
            : (Math.floor(current.getUTCMonth() / 3) === Math.floor(state.viewDate.getUTCMonth() / 3) && current.getUTCFullYear() === state.viewDate.getUTCFullYear());

        const isToday = (step === 'month')
            ? (current.getUTCMonth() === currentMonth && current.getUTCFullYear() === currentYear)
            : (Math.floor(current.getUTCMonth() / 3) === Math.floor(currentMonth / 3) && current.getUTCFullYear() === currentYear);

        let label = '';
        if (step === 'month') {
            label = new Intl.DateTimeFormat('fr-BE', { month: 'short', timeZone: 'UTC' }).format(current).replace('.', '');
            const yrLabel = current.getUTCFullYear().toString().slice(-2);
            label = `<span class="uppercase">${label}</span><span class="text-[9px] opacity-60 ml-0.5">${yrLabel}</span>`;
        } else {
            const quarter = Math.floor(current.getUTCMonth() / 3) + 1;
            label = `T${quarter} <span class="text-[9px] opacity-60 ml-0.5">${current.getUTCFullYear().toString().slice(-2)}</span>`;
        }

        let bgClass = 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800';
        if (isSelected) {
            bgClass = 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105 z-10';
        }

        html += `
            <button onclick="window.app.setViewDate('${current.toISOString()}')" 
                    class="flex-none px-5 py-2.5 rounded-xl text-[11px] font-black transition-all duration-300 flex flex-col items-center gap-0.5 relative ${bgClass}">
                ${label}
                ${isToday && !isSelected ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"></div>' : ''}
            </button>
        `;

        if (step === 'month') {
            current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
        } else {
            current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 3, 1));
        }
    }

    container.innerHTML = html;
    setTimeout(() => {
        const selectedBtn = container.querySelector('.bg-indigo-600');
        if(selectedBtn) selectedBtn.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }, 10);
};
export const renderAnticipatedExpenses = () => {
    const anticipatedList = document.getElementById('anticipated-list');
    let allNonRecurring = [];

    // Collect from selected month, next month, and next+1 month
    for (let i = 0; i < 3; i++) {
        const targetDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + i, 1);
        const monthKey = getMonthKey(targetDate);
        const monthItems = (state.records[monthKey]?.items || []).filter(item => 
            !item.Model && 
            getTxDisplayInfo(item.source, item.destination).isExpense
        );
        allNonRecurring = [...allNonRecurring, ...monthItems];
    }

    if(allNonRecurring.length === 0) {
        const highlight = document.getElementById('anticipated-highlight');
        if (highlight) highlight.classList.add('hidden');
        return;
    }

    // Sort by date ascending
    allNonRecurring.sort((a, b) => new Date(a.date) - new Date(b.date));

    const highlight = document.getElementById('anticipated-highlight');
    if (highlight) highlight.classList.remove('hidden');
    anticipatedList.innerHTML = allNonRecurring.map(item => `
        <div class="bg-white/60 rounded-lg p-3 border border-amber-100 flex justify-between items-center shadow-sm">
            <div class="truncate pr-2">
                <div class="font-medium text-amber-900">${item.label}</div>
                <div class="text-xs text-amber-600 font-semibold">
                    <i class="fa-regular fa-calendar mr-1"></i>${formatDateStr(item.date)}
                </div>
            </div>
            <span class="font-bold text-amber-700 whitespace-nowrap">- ${formatCurrency(item.amount)}</span>
        </div>`).join('');
};

export const populateCategoryFilter = () => {
    const selects = [document.getElementById('filter-category'), document.getElementById('filter-category-mobile')];
    
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="all">Toutes les catégories</option>';
        for (const category of state.categories) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.label;
            select.appendChild(option);
        }
        if (currentVal) select.value = currentVal;
    });
};

export const populateAccountFilter = () => {
    const selects = [document.getElementById('filter-account'), document.getElementById('filter-account-mobile')];
    
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="all">Tous les comptes</option>';
        for (const account of state.accounts) {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            select.appendChild(option);
        }
        if (currentVal) select.value = currentVal;
    });
};

export const renderDashboard = () => {
    renderTimeline();
    
    const currentMonthKey = getMonthKey(state.viewDate);
    const currentMonthData = state.records[currentMonthKey] || { items: [], status: 'open' };

    const savedSortOrder = 'default';
    const sortOrderSelect = document.getElementById('sort-order');
    if (sortOrderSelect) {
        sortOrderSelect.value = savedSortOrder;
    }
    const sortOrderMobile = document.getElementById('sort-order-mobile');
    if (sortOrderMobile) {
        sortOrderMobile.value = savedSortOrder;
    }

    //const currentMonthKey = getMonthKey(state.viewDate);
    const balances = state.months[currentMonthKey]?.balances || calculateBalances(state.viewDate);
    const totalBalance = Object.values(balances).reduce((sum, b) => sum + b, 0);
    const isAnyAccountDirty = state.accounts.some(acc => acc.balanceDirty !== false);

    const totalBalanceEl = document.getElementById('dash-total-balance');
    if (totalBalanceEl) {
        totalBalanceEl.innerHTML = `
            <div class="flex items-center gap-2 justify-center">
                ${formatCurrency(totalBalance)}
                ${isAnyAccountDirty ? '<i class="fa-solid fa-arrows-rotate fa-spin text-sm text-amber-500" title="Recalcul des soldes en cours ..."></i>' : ''}
            </div>
        `;
    }

    const monthIncome = calculateMonthlyIncome(state.viewDate);
    const monthExpense = currentMonthData.items
        .filter(item => getTxDisplayInfo(item.source, item.destination).isExpense)
        .reduce((sum, item) => sum + item.amount, 0);

    const dashMonthIncomeEl = document.getElementById('dash-month-income');
    if (dashMonthIncomeEl) dashMonthIncomeEl.textContent = formatCurrency(monthIncome);
    
    const dashMonthExpenseEl = document.getElementById('dash-month-expense');
    if (dashMonthExpenseEl) dashMonthExpenseEl.textContent = formatCurrency(monthExpense);

    const diff = monthIncome - monthExpense;
    const diffEl = document.getElementById('dash-month-diff');
    if (diffEl) {
        if (diff >= 0) {
            diffEl.textContent = `${formatCurrency(diff)} restant à dépenser`;
            diffEl.className = 'text-xs font-medium mt-2 text-green-600';
        } else {
            diffEl.textContent = `${formatCurrency(Math.abs(diff))} de dépassement`;
            diffEl.className = 'text-xs font-medium mt-2 text-red-600';
        }
    }

    const savingsBalance = state.accounts.filter(a => a.isSaving).reduce((sum, a) => sum + (balances[a.id] || 0), 0);
    const targetFund = monthExpense * (state.emergencyFundMultiplier || 3);
    const progressPct = targetFund > 0 ? Math.min((savingsBalance / targetFund) * 100, 100) : 0;
    const isEmergencyOk = savingsBalance >= targetFund;
    const dashEmergencyFundEl = document.getElementById('dash-emergency-fund');
    if (dashEmergencyFundEl) {
        dashEmergencyFundEl.innerHTML = `
            <div class="flex items-baseline gap-2">
                <h2 class="text-3xl font-bold ${isEmergencyOk ? 'text-green-600' : 'text-amber-600'}">${formatCurrency(savingsBalance)}</h2>
                ${isEmergencyOk ? '<i class="fa-solid fa-check-circle text-green-500 text-xl"></i>' : ''}
            </div>
            <p class="text-[10px] text-slate-400 mt-1 mb-3">Objectif (${state.emergencyFundMultiplier || 3}m): ${formatCurrency(targetFund)}</p>
            <div class="w-full bg-slate-100 rounded-full h-1.5"><div class="${isEmergencyOk ? 'bg-green-500' : 'bg-amber-500'} h-full rounded-full" style="width: ${progressPct}%"></div></div>`;
    }

    // Net Worth Calculation
    const getLatestSnapshot = (entityId, isAsset = true) => {
        const values = isAsset 
            ? state.assetValues.filter(v => v.asset_id === entityId)
            : state.liabilityValues.filter(v => v.liability_id === entityId);
        if (values.length === 0) return 0;
        return values.sort((a, b) => new Date(b.date) - new Date(a.date))[0].value;
    };

    const totalAssetsVal = state.assets.reduce((sum, a) => sum + getLatestSnapshot(a.id, true), 0);
    const totalLiabilitiesVal = state.liabilities.reduce((sum, l) => sum + getLatestSnapshot(l.id, false), 0);
    const netWorth = totalBalance + totalAssetsVal - totalLiabilitiesVal;

    const netWorthEl = document.getElementById('dash-net-worth');
    if (netWorthEl) {
        netWorthEl.innerHTML = `
            <div class="flex items-baseline gap-2">
                <h2 class="text-3xl font-black text-indigo-600">${formatCurrency(netWorth)}</h2>
            </div>
            <p class="text-xs text-slate-400 mt-1">Patrimoine Net Total</p>
        `;
    }

    populateCategoryFilter();
    populateAccountFilter();
    renderTransactions();
    renderAnticipatedExpenses();

    const expensePercentage = monthIncome > 0 ? (monthExpense / monthIncome) * 100 : 0;
    const expensePercentageBar = document.getElementById('expense-percentage-bar');
    if (expensePercentageBar) expensePercentageBar.style.width = `${expensePercentage}%`;
    const expensePercentageText = document.getElementById('expense-percentage-text');
    if (expensePercentageText) expensePercentageText.textContent = `${expensePercentage.toFixed(0)}%`;

    let nextMonthExpectedIncome = 0, nextMonthExpectedExpense = 0;
    const nextMonthKey = getMonthKey(new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1));
    (state.records[nextMonthKey]?.items || []).forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        if(txInfo.isIncome) nextMonthExpectedIncome += item.amount;
        if(txInfo.isExpense) nextMonthExpectedExpense += item.amount;
    });
    const forecastBalance = totalBalance + nextMonthExpectedIncome - nextMonthExpectedExpense;
    const forecastBalanceEl = document.getElementById('forecast-balance');
    if (forecastBalanceEl) forecastBalanceEl.textContent = formatCurrency(forecastBalance);

    const clotureBtn = document.getElementById('btn-cloture');
    const isMonthClosed = currentMonthData.status === 'closed';
    if (clotureBtn) {
        clotureBtn.disabled = isMonthClosed;
        if(isMonthClosed) {
            clotureBtn.innerHTML = `<i class="fa-solid fa-lock mr-2"></i>Mois clôturé`;
        } else {
            clotureBtn.innerHTML = `<i class="fa-solid fa-lock-open mr-2"></i>Clôturer le mois`;
        }
    }

    const addTxBtn = document.querySelector('button[onclick="window.app.openTransactionModal()"]');
    const filterCategoryEl = document.getElementById('filter-category');
    const filterAccountEl = document.getElementById('filter-account');

    if (isMonthClosed) {
        if (filterCategoryEl) filterCategoryEl.disabled = true;
        if (filterAccountEl) filterAccountEl.disabled = true;
        if (addTxBtn) addTxBtn.disabled = true;
    } else {
        if (filterCategoryEl) filterCategoryEl.disabled = false;
        if (filterAccountEl) filterAccountEl.disabled = false;
        if (addTxBtn) addTxBtn.disabled = false;
    }

    renderSankeyChart();
    renderLiquidityChart();
};

let googleChartsLoaded = false;

export const renderLiquidityChart = () => {
    const container = document.getElementById('liquidity-chart');
    const detailsContainer = document.getElementById('liquidity-details');
    if (!container || !detailsContainer) return;

    if (!googleChartsLoaded) {
        if (typeof google === 'undefined') {
            container.innerHTML = 'Google Charts non chargé';
            return;
        }
        google.charts.load('current', {packages:['sankey', 'corechart']});
        google.charts.setOnLoadCallback(() => {
            googleChartsLoaded = true;
            renderLiquidityChart();
            renderSankeyChart();
        });
        return;
    }

    const currentMonthKey = getMonthKey(state.viewDate);
    const balances = state.months[currentMonthKey]?.balances || calculateBalances(state.viewDate);
    
    // Grouping accounts by type
    const groupTotals = {
        'Paiement': 0,
        'Épargne': 0,
        'Investissement': 0,
        'Patrimoine': 0,
        'Dettes': 0
    };

    const typeDetails = {
        'Paiement': [],
        'Épargne': [],
        'Investissement': [],
        'Patrimoine': [],
        'Dettes': []
    };

    // 1. Accounts
    state.accounts.forEach(acc => {
        const balance = balances[acc.id] || 0;
        let type = 'Paiement';
        if (acc.isSaving) type = 'Épargne';
        else if (acc.isInvestmentAccount) type = 'Investissement';
        
        groupTotals[type] += balance;
        typeDetails[type].push({ name: acc.name, balance });
    });

    // 2. Assets
    const getLatestSnapshotVal = (entityId, isAsset = true) => {
        const values = isAsset 
            ? state.assetValues.filter(v => v.asset_id === entityId)
            : state.liabilityValues.filter(v => v.liability_id === entityId);
        if (values.length === 0) return 0;
        return values.sort((a, b) => new Date(b.date) - new Date(a.date))[0].value;
    };

    state.assets.forEach(asset => {
        const val = getLatestSnapshotVal(asset.id, true);
        groupTotals['Patrimoine'] += val;
        typeDetails['Patrimoine'].push({ name: asset.name, balance: val });
    });

    // 3. Liabilities
    state.liabilities.forEach(l => {
        const val = getLatestSnapshotVal(l.id, false);
        groupTotals['Dettes'] -= val; // Display as negative in total but positive in absolute distribution if needed? No, debts reduce net worth.
        typeDetails['Dettes'].push({ name: l.name, balance: -val });
    });

    const totalNetWorth = Object.values(groupTotals).reduce((sum, b) => sum + b, 0);

    // Distribution chart should probably focus on Assets (Positive values)
    const distributionTotals = { ...groupTotals };
    delete distributionTotals['Dettes']; // Usually exclude debt from asset allocation pie

    const chartRows = Object.entries(distributionTotals)
        .filter(([type, total]) => total > 0)
        .map(([type, total]) => [type, total]);

    if (chartRows.length === 0) {
        container.innerHTML = '<div class="text-slate-400 italic">Aucune donnée de patrimoine détectée</div>';
    } else {
        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Type');
        data.addColumn('number', 'Valeur');
        data.addRows(chartRows);

        const options = {
            pieHole: 0.4,
            chartArea: {width: '100%', height: '80%'},
            legend: { position: 'bottom', alignment: 'center', textStyle: { fontName: 'Inter', fontSize: 10, bold: true } },
            colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#f43f5e'],
            backgroundColor: 'transparent',
            pieSliceTextStyle: { fontName: 'Inter', fontSize: 11, bold: true },
            tooltip: { textStyle: { fontName: 'Inter' }, showColorCode: true }
        };

        const chart = new google.visualization.PieChart(container);
        chart.draw(data, options);
    }

    // Render grouped details table
    let detailsHtml = `
        <div class="space-y-4">
            ${Object.entries(typeDetails).filter(([type, items]) => items.length > 0).map(([type, items]) => {
                const groupTotal = groupTotals[type];
                const absGroupTotal = Math.abs(groupTotal);
                const absNetWorth = Math.abs(totalNetWorth);
                const groupPct = absNetWorth > 0 ? (absGroupTotal / absNetWorth) * 100 : 0;
                
                return `
                    <div class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div class="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${type}</span>
                            <div class="text-right">
                                <span class="text-sm font-bold text-slate-900">${formatCurrency(groupTotal)}</span>
                            </div>
                        </div>
                        <div class="p-2 space-y-1">
                            ${items.map(item => `
                                <div class="flex justify-between items-center px-2 py-1">
                                    <span class="text-xs font-medium text-slate-600">${item.name}</span>
                                    <span class="text-xs font-bold ${item.balance >= 0 ? 'text-slate-700' : 'text-rose-600'}">${formatCurrency(item.balance)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div class="pt-4 border-t border-slate-200 flex justify-between items-center px-2">
                <span class="text-xs font-black text-slate-900 uppercase tracking-wider">Patrimoine Net Total</span>
                <span class="text-xl font-black text-indigo-600">${formatCurrency(totalNetWorth)}</span>
            </div>
        </div>
    `;
    detailsContainer.innerHTML = detailsHtml;
};

export const renderSankeyChart = (isExpanded = false) => {
    const containerId = isExpanded ? 'sankey-chart-expanded' : 'sankey-chart';
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!googleChartsLoaded) {
        if (typeof google === 'undefined') {
            container.innerHTML = 'Google Charts non chargé';
            return;
        }
        google.charts.load('current', {packages:['sankey', 'corechart']});
        google.charts.setOnLoadCallback(() => {
            googleChartsLoaded = true;
            renderLiquidityChart();
            renderSankeyChart(isExpanded);
        });
        return;
    }

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };
    
    // First pass: Calculate totals for percentages
    let totalIncome = 0;
    const nodeIncomingSum = {};
    
    monthData.items.forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        if (txInfo.isIncome) {
            totalIncome += item.amount;
            nodeIncomingSum[txInfo.dst.name] = (nodeIncomingSum[txInfo.dst.name] || 0) + item.amount;
        } else if (txInfo.isExpense) {
            const category = state.categories.find(c => c.id === item.Category);
            const catLabel = category ? category.label : 'Sans catégorie';
            nodeIncomingSum[catLabel] = (nodeIncomingSum[catLabel] || 0) + item.amount;
        } else if (item.source && item.destination) {
            const destLabel = txInfo.dst.name + ' (Épargne)';
            nodeIncomingSum[destLabel] = (nodeIncomingSum[destLabel] || 0) + item.amount;
        }
    });

    // Helper to format labels with percentages
    const getLabel = (name) => {
        if (name === 'Entrées' || totalIncome === 0) return name;
        const sum = nodeIncomingSum[name] || 0;
        const pct = ((sum / totalIncome) * 100).toFixed(0);
        return `${name} (${pct}%)`;
    };

    const rows = [];
    const colorsMap = {};

    // Helper to get consistent colors
    const INCOME_COLOR = '#10b981'; // Green
    const CURRENT_ACC_COLOR = '#3b82f6'; // Blue
    const SAVINGS_ACC_COLOR = '#8b5cf6'; // Purple
    const OTHER_COLOR = '#94a3b8'; // Slate

    colorsMap['Entrées'] = INCOME_COLOR;

    // Second pass: Build rows with percentages
    monthData.items.forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        const sourceName = txInfo.src.name;
        const destName = txInfo.dst.name;
        
        if (txInfo.isIncome) {
            const labeledDest = getLabel(destName);
            rows.push(['Entrées', labeledDest, item.amount]);
            const acc = state.accounts.find(a => a.id === item.destination);
            colorsMap[labeledDest] = acc?.isSaving ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
        } else if (txInfo.isExpense) {
            const category = state.categories.find(c => c.id === item.Category);
            const catLabel = category ? category.label : 'Sans catégorie';
            
            const labeledSrc = getLabel(sourceName);
            const labeledDest = getLabel(catLabel);
            rows.push([labeledSrc, labeledDest, item.amount]);
            
            const acc = state.accounts.find(a => a.id === item.source);
            colorsMap[labeledSrc] = acc?.isSaving ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
            colorsMap[labeledDest] = category?.color || OTHER_COLOR;
        } else if (item.source && item.destination) {
            const destLabel = destName + ' (Épargne)';
            const labeledSrc = getLabel(sourceName);
            const labeledDest = getLabel(destLabel);
            rows.push([labeledSrc, labeledDest, item.amount]);
            
            const srcAcc = state.accounts.find(a => a.id === item.source);
            const dstAcc = state.accounts.find(a => a.id === item.destination);
            colorsMap[labeledSrc] = srcAcc?.isSaving ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
            colorsMap[labeledDest] = dstAcc?.isSaving ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
        }
    });

    if (rows.length === 0) {
        container.innerHTML = '<div class="text-slate-400 italic">Aucune donnée pour ce mois</div>';
        return;
    }

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Weight');
    data.addRows(rows);

    // Extract nodes in order to map colors
    const uniqueNodes = Array.from(new Set(rows.flatMap(r => [r[0], r[1]])));
    const nodeColors = uniqueNodes.map(node => colorsMap[node] || OTHER_COLOR);

    // Sets chart options.
    const options = {
        width: container.offsetWidth,
        height: isExpanded ? container.offsetHeight : 320,
        sankey: {
            node: { 
                label: { fontName: 'Inter', fontSize: isExpanded ? 12 : 10, color: '#475569', bold: true },
                nodePadding: isExpanded ? 30 : 20,
                width: 15,
                colors: nodeColors,
                interactivity: true
            },
            link: {
                colorMode: 'gradient',
                fillOpacity: 0.2
            }
        }
    };

    // Instantiates and draws our chart, passing in some options.
    const chart = new google.visualization.Sankey(container);
    chart.draw(data, options);
};

// Handle window resize for chart responsiveness
window.addEventListener('resize', () => {
    if (googleChartsLoaded) {
        if (document.getElementById('sankey-chart')) renderSankeyChart();
        if (document.getElementById('liquidity-chart')) renderLiquidityChart();
    }
});

export const clotureMois = async () => {
    const currentMonthKey = getMonthKey(state.viewDate);
    if (state.records[currentMonthKey]?.status === 'closed') {
        showNotification('Ce mois est déjà clôturé.', 'error');
        return;
    }

    if (confirm(`Êtes-vous sûr de vouloir clôturer le mois de ${new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(state.viewDate)} ? Cette action est irréversible.`)) {
        try {
            const balances = calculateBalances(state.viewDate);
            const updates = [];
            const closingDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 0);
            const closingDateStr = closingDate.toISOString().split('T')[0];
            
            // Update all accounts with new initial balances based on the closed month
            state.accounts.forEach(acc => {
                const newBalance = balances[acc.id] || 0;
                // Also update the createDate to create a new checkpoint
                updates.push(updateAccountInFirestore(currentUserId, { 
                    ...acc, 
                    initialBalance: newBalance, 
                    createDate: closingDateStr 
                }, acc.initialBalance));
            });

            // Mark current month as closed
            updates.push(updateMonthStatus(currentUserId, currentMonthKey, 'closed'));

            // Also close previous open months
            Object.keys(state.records).forEach(monthKey => {
                if (monthKey < currentMonthKey && state.records[monthKey].status !== 'closed') {
                    updates.push(updateMonthStatus(currentUserId, monthKey, 'closed'));
                }
            });

            await Promise.all(updates);
            
            showNotification('Mois clôturé avec succès. Les soldes initiaux ont été mis à jour.');
        } catch (err) {
            showNotification('Erreur lors de la clôture', 'error');
        }
    }
};
