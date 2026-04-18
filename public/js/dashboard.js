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

    // Filters & Search - Handling Multi-Select
    const getSelectedValues = (id) => {
        const el = document.getElementById(id);
        if (!el) return ['all'];
        const values = Array.from(el.selectedOptions).map(opt => opt.value);
        if (values.length === 0 || values.includes('all')) return ['all'];
        return values;
    };

    const categoryFilters = getSelectedValues('filter-category');
    const accountFilters = getSelectedValues('filter-account');
    
    const categoryFiltersMobile = getSelectedValues('filter-category-mobile');
    const accountFiltersMobile = getSelectedValues('filter-account-mobile');
    
    const finalCategoryFilters = categoryFilters.includes('all') ? categoryFiltersMobile : categoryFilters;
    const finalAccountFilters = accountFilters.includes('all') ? accountFiltersMobile : accountFilters;

    const searchFilter = (document.getElementById('search-transactions')?.value || '').toLowerCase();
    const sortOrder = document.getElementById('sort-order')?.value || document.getElementById('sort-order-mobile')?.value || 'default';

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [], status: 'open' };
    
    // Calculate Previous Month Data for Variance
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

    // Apply Filters
    if (!finalCategoryFilters.includes('all')) {
        filteredItems = filteredItems.filter(item => finalCategoryFilters.includes(item.Category));
    }
    if (!finalAccountFilters.includes('all')) {
        filteredItems = filteredItems.filter(item => finalAccountFilters.includes(item.source) || finalAccountFilters.includes(item.destination));
    }

    // Apply Search
    if (searchFilter) {
        filteredItems = filteredItems.filter(item => {
            const category = state.categories.find(c => c.id === item.Category);
            const categoryLabel = category ? category.label.toLowerCase() : '';
            const amountStr = item.amount.toString();
            return item.label.toLowerCase().includes(searchFilter) || 
                   categoryLabel.includes(searchFilter) || 
                   amountStr.includes(searchFilter);
        });
    }

    const getType = (tx) => {
        const txInfo = getTxDisplayInfo(tx.source, tx.destination);
        if (txInfo.isIncome) return 'Revenu';
        if (txInfo.isExpense) return 'Dépense';
        return 'Transfert';
    };

    const getPrimaryAccountName = (tx) => {
        const txInfo = getTxDisplayInfo(tx.source, tx.destination);
        if (txInfo.isExpense) return txInfo.src.name;
        if (txInfo.isIncome) return txInfo.dst.name;
        return txInfo.src.name;
    };

    // Grouping Logic
    const groups = {};
    filteredItems.forEach(item => {
        const catId = item.Category || 'uncategorized';
        if (!groups[catId]) groups[catId] = { items: [], total: 0 };
        groups[catId].items.push(item);
        
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        const amount = txInfo.isIncome ? item.amount : (txInfo.isExpense ? -item.amount : 0);
        groups[catId].total += amount;
    });

    // Load expanded states from localStorage
    const expandedStates = JSON.parse(localStorage.getItem('strady_expanded_categories') || '{}');

    // Sort Groups based on Category Index or Total
    const sortedGroupIds = Object.keys(groups).sort((a, b) => {
        const catA = state.categories.find(c => c.id === a);
        const catB = state.categories.find(c => c.id === b);
        const orderA = catA ? (catA['index-order'] ?? 999) : 999;
        const orderB = catB ? (catB['index-order'] ?? 999) : 999;
        return orderA - orderB;
    });

    // Sub-item sorting logic (internal to each group)
    const sortSubItems = (items) => {
        return items.sort((a, b) => {
            switch (sortOrder) {
                case 'account': return getPrimaryAccountName(a).localeCompare(getPrimaryAccountName(b));
                case 'amount-desc': return b.amount - a.amount;
                case 'amount-asc': return a.amount - b.amount;
                case 'date-desc': return new Date(b.date) - new Date(a.date);
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
        const sign = diff > 0 ? '+' : '';
        
        return `<span class="text-[10px] font-bold ${colorClass} flex items-center gap-1 ml-2">
            <i class="fa-solid ${icon}"></i> ${sign}${formatCurrency(diff)}
        </span>`;
    };

    // Render mobile content
    if (container) {
        let html = '';
        sortedGroupIds.forEach(catId => {
            const group = groups[catId];
            const category = state.categories.find(c => c.id === catId);
            const isMonthClosed = monthData.status === 'closed';
            const isExpanded = !!expandedStates[catId];
            
            const groupHeaderHtml = `
                <div class="category-group-header flex items-center justify-between p-3 bg-slate-50 border-y border-slate-100 cursor-pointer sticky top-0 z-10" onclick="window.app.toggleCategoryGroup('${catId}')">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform chevron ${isExpanded ? 'rotate-180' : ''}"></i>
                        <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px]" style="background-color: ${category?.color || '#94a3b8'}">
                            <i class="fa-solid ${category?.icon || 'fa-tag'}"></i>
                        </div>
                        <span class="text-sm font-bold text-slate-700">${category?.label || 'Sans catégorie'}</span>
                        <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">${group.items.length}</span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-sm font-bold ${group.total >= 0 ? 'text-slate-700' : 'text-slate-900'}">${formatCurrency(group.total)}</span>
                        ${renderVariance(catId, group.total)}
                    </div>
                </div>
            `;

            const itemsHtml = `
                <ul class="divide-y divide-slate-50 transition-all duration-300 ${isExpanded ? '' : 'hidden'}">
                    ${sortSubItems(group.items).map((item, index) => {
                        const txInfo = getTxDisplayInfo(item.source, item.destination);
                        const isRecurring = !!item.Model;
                        return `
                            <li class="p-4 flex items-center justify-between gap-4 group transaction-item-animate">
                                <div class="flex items-center gap-4 flex-grow truncate pl-4">
                                    <div class="flex-1 truncate">
                                        <div class="flex items-center gap-2">
                                            <p class="font-semibold text-slate-800 truncate">${item.label}</p>
                                            ${isRecurring ? '<i class="fa-solid fa-arrows-rotate text-xs text-slate-400"></i>' : ''}
                                        </div>
                                        <p class="text-xs text-slate-500 font-medium truncate">${txInfo.src.name} → ${txInfo.dst.name}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="text-right whitespace-nowrap">
                                        <p class="font-bold ${txInfo.ui.color}">${txInfo.ui.prefix || ''}${formatCurrency(item.amount)}</p>
                                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${formatDateStr(item.date)}</p>
                                    </div>
                                    ${!isMonthClosed ? `
                                    <button onclick="window.app.openMobileActions('${item.id}')" class="p-2 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                    ` : ''}
                                </div>
                            </li>`;
                    }).join('')}
                </ul>
            `;

            html += `<div class="category-group">${groupHeaderHtml}${itemsHtml}</div>`;
        });
        container.innerHTML = html || '<div class="p-8 text-center text-slate-400 italic">Aucune transaction trouvée</div>';
    }

    // Render desktop content
    if (tableBody) {
        let html = '';
        sortedGroupIds.forEach(catId => {
            const group = groups[catId];
            const category = state.categories.find(c => c.id === catId);
            const isMonthClosed = monthData.status === 'closed';
            const isExpanded = !!expandedStates[catId];

            const groupHeaderHtml = `
                <tr class="bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors" onclick="window.app.toggleCategoryGroup('${catId}')">
                    <td colspan="6" class="px-6 py-3 category-group-header-row">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <i class="fa-solid fa-chevron-down text-xs text-slate-400 transition-transform chevron ${isExpanded ? '' : 'rotate-[-90deg]'}"></i>
                                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white" style="background-color: ${category?.color || '#94a3b8'}">
                                    <i class="fa-solid ${category?.icon || 'fa-tag'}"></i>
                                </div>
                                <span class="font-bold text-slate-800">${category?.label || 'Sans catégorie'}</span>
                                <span class="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold">${group.items.length} items</span>
                            </div>
                            <div class="flex items-center gap-6">
                                ${renderVariance(catId, group.total)}
                                <span class="text-lg font-black ${group.total >= 0 ? 'text-slate-700' : 'text-slate-900'}">${formatCurrency(group.total)}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            const itemsHtml = sortSubItems(group.items).map((item, index) => {
                const txInfo = getTxDisplayInfo(item.source, item.destination);
                const isRecurring = !!item.Model;
                return `
                    <tr class="group hover:bg-slate-50/50 transition-colors border-l-4 ${isExpanded ? '' : 'hidden'}" style="border-left-color: ${category?.color || '#cbd5e1'}">
                        <td class="px-6 py-4 text-sm text-slate-500 font-medium whitespace-nowrap">${formatDateStr(item.date)}</td>
                        <td class="px-6 py-4">
                            <span class="text-[10px] font-black px-2 py-1 rounded-full ${txInfo.ui.color} bg-white border border-current">${getType(item).toUpperCase()}</span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-slate-800">${item.label}</span>
                                ${isRecurring ? '<i class="fa-solid fa-arrows-rotate text-[10px] text-slate-400" title="Récurrente"></i>' : ''}
                            </div>
                            <div class="text-[10px] text-slate-400 font-medium">${txInfo.src.name} → ${txInfo.dst.name}</div>
                        </td>
                        <td class="px-6 py-4 text-right whitespace-nowrap">
                            <span class="font-bold ${txInfo.ui.color}">${txInfo.ui.prefix || ''}${formatCurrency(item.amount)}</span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                ${!isMonthClosed ? `
                                <button onclick="window.app.editTransaction('${item.id}')" class="p-2 text-slate-400 hover:text-blue-600"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="window.app.deleteTransaction('${item.id}')" class="p-2 text-slate-400 hover:text-rose-600"><i class="fa-solid fa-trash text-xs"></i></button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>`;
            }).join('');

            html += groupHeaderHtml + itemsHtml;
        });
        tableBody.innerHTML = html || '<tr><td colspan="6" class="p-8 text-center text-slate-400 italic">Aucune transaction trouvée</td></tr>';
    }
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

    while (current <= endDate) {
        const isSelected = (step === 'month') 
            ? (current.getUTCMonth() === state.viewDate.getUTCMonth() && current.getUTCFullYear() === state.viewDate.getUTCFullYear())
            : (Math.floor(current.getUTCMonth() / 3) === Math.floor(state.viewDate.getUTCMonth() / 3) && current.getUTCFullYear() === state.viewDate.getUTCFullYear());

        const isToday = (step === 'month')
            ? (current.getUTCMonth() === currentMonth && current.getUTCFullYear() === currentYear)
            : (Math.floor(current.getUTCMonth() / 3) === Math.floor(currentMonth / 3) && current.getUTCFullYear() === currentYear);

        let label = '';
        if (step === 'month') {
            label = new Intl.DateTimeFormat('fr-BE', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(current);
        } else {
            const quarter = Math.floor(current.getUTCMonth() / 3) + 1;
            label = `T${quarter} ${current.getUTCFullYear().toString().slice(-2)}`;
        }

        let bgClass = 'bg-white text-slate-500 hover:bg-slate-50';
        if (isSelected) {
            bgClass = 'bg-blue-600 text-white shadow-md';
        } else if (isToday) {
            bgClass = 'bg-blue-50 text-blue-600 border border-blue-200';
        }

        html += `<button onclick="window.app.setViewDate('${current.toISOString()}')" class="flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${bgClass}">${label}</button>`;

        if (step === 'month') {
            current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
        } else {
            current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 3, 1));
        }
    }

    container.innerHTML = html;
    setTimeout(() => {
        const selectedBtn = container.querySelector('.bg-blue-600');
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
    const targetFund = monthExpense * 3;
    const progressPct = targetFund > 0 ? Math.min((savingsBalance / targetFund) * 100, 100) : 0;
    const isEmergencyOk = savingsBalance >= targetFund;
    const dashEmergencyFundEl = document.getElementById('dash-emergency-fund');
    if (dashEmergencyFundEl) {
        dashEmergencyFundEl.innerHTML = `
            <div class="flex items-baseline gap-2">
                <h2 class="text-3xl font-bold ${isEmergencyOk ? 'text-green-600' : 'text-amber-600'}">${formatCurrency(savingsBalance)}</h2>
                ${isEmergencyOk ? '<i class="fa-solid fa-check-circle text-green-500 text-xl"></i>' : ''}
            </div>
            <p class="text-xs text-slate-400 mt-1 mb-3">Objectif: ${formatCurrency(targetFund)}</p>
            <div class="w-full bg-slate-100 rounded-full h-2"><div class="${isEmergencyOk ? 'bg-green-500' : 'bg-amber-500'} h-full rounded-full" style="width: ${progressPct}%"></div></div>`;
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
        'Investissement': 0
    };

    const typeDetails = {
        'Paiement': [],
        'Épargne': [],
        'Investissement': []
    };

    state.accounts.forEach(acc => {
        const balance = balances[acc.id] || 0;
        let type = 'Paiement';
        if (acc.isSaving) type = 'Épargne';
        else if (acc.isInvestmentAccount) type = 'Investissement';
        
        groupTotals[type] += balance;
        typeDetails[type].push({ ...acc, balance });
    });

    const totalLiquidity = Object.values(groupTotals).reduce((sum, b) => sum + b, 0);

    // Filter out zero/negative groups for the pie chart
    const chartRows = Object.entries(groupTotals)
        .filter(([type, total]) => total > 0)
        .map(([type, total]) => [type, total]);

    if (chartRows.length === 0) {
        container.innerHTML = '<div class="text-slate-400 italic">Aucune liquidité positive détectée</div>';
    } else {
        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Type de Compte');
        data.addColumn('number', 'Solde');
        data.addRows(chartRows);

        const options = {
            pieHole: 0.4,
            chartArea: {width: '100%', height: '80%'},
            legend: { position: 'bottom', alignment: 'center', textStyle: { fontName: 'Inter', fontSize: 11, bold: true } },
            colors: ['#3b82f6', '#10b981', '#6366f1'], // Blue, Emerald, Indigo
            backgroundColor: 'transparent',
            pieSliceTextStyle: { fontName: 'Inter', fontSize: 12, bold: true },
            tooltip: { textStyle: { fontName: 'Inter' }, showColorCode: true }
        };

        const chart = new google.visualization.PieChart(container);
        chart.draw(data, options);
    }

    // Render grouped details table
    let detailsHtml = `
        <div class="space-y-6">
            ${Object.entries(typeDetails).filter(([type, accounts]) => accounts.length > 0).map(([type, accounts]) => {
                const groupTotal = groupTotals[type];
                const groupPct = totalLiquidity > 0 ? (Math.max(0, groupTotal) / totalLiquidity) * 100 : 0;
                
                return `
                    <div class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div class="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                            <span class="text-xs font-black text-slate-500 uppercase tracking-widest">${type}</span>
                            <div class="text-right">
                                <span class="text-sm font-bold text-slate-900">${formatCurrency(groupTotal)}</span>
                                <span class="text-[10px] text-slate-400 font-bold ml-1">(${groupPct.toFixed(1)}%)</span>
                            </div>
                        </div>
                        <div class="p-3 space-y-2">
                            ${accounts.map(acc => {
                                const accPct = groupTotal > 0 ? (Math.max(0, acc.balance) / groupTotal) * 100 : 0;
                                return `
                                    <div class="flex justify-between items-center px-1">
                                        <div class="flex flex-col">
                                            <span class="text-xs font-semibold text-slate-600">${acc.name}</span>
                                            <span class="text-[9px] text-slate-400">${accPct.toFixed(0)}% du groupe</span>
                                        </div>
                                        <span class="text-xs font-bold ${acc.balance >= 0 ? 'text-slate-700' : 'text-red-600'}">${formatCurrency(acc.balance)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div class="pt-4 border-t border-slate-200 flex justify-between items-center px-2">
                <span class="text-sm font-black text-slate-900 uppercase tracking-wider">Total Patrimoine</span>
                <span class="text-xl font-black text-slate-900">${formatCurrency(totalLiquidity)}</span>
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
