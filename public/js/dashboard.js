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
    
    // If we are on mobile, we might need to check the mobile filters too if the desktop ones aren't the source
    const categoryFiltersMobile = getSelectedValues('filter-category-mobile');
    const accountFiltersMobile = getSelectedValues('filter-account-mobile');
    
    const finalCategoryFilters = categoryFilters.includes('all') ? categoryFiltersMobile : categoryFilters;
    const finalAccountFilters = accountFilters.includes('all') ? accountFiltersMobile : accountFilters;

    const searchFilter = (document.getElementById('search-transactions')?.value || '').toLowerCase();
    const sortOrder = document.getElementById('sort-order')?.value || 'date-desc';

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };
    
    let filteredItems = [...monthData.items];

    // Apply Filters (Multi-select logic)
    if (!finalCategoryFilters.includes('all')) {
        filteredItems = filteredItems.filter(item => finalCategoryFilters.includes(item.Category));
    }
    if (!finalAccountFilters.includes('all')) {
        filteredItems = filteredItems.filter(item => finalAccountFilters.includes(item.source) || finalAccountFilters.includes(item.destination));
    }

    // Apply Search (Label, Category Label, Amount)
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
        return txInfo.src.name; // Default for transfer
    };

    // Sort Logic
    filteredItems.sort((a, b) => {
        switch (sortOrder) {
            case 'account': {
                const nameA = getPrimaryAccountName(a).toLowerCase();
                const nameB = getPrimaryAccountName(b).toLowerCase();
                return nameA.localeCompare(nameB) || new Date(b.date) - new Date(a.date);
            }
            case 'type': {
                const typeA = getType(a);
                const typeB = getType(b);
                return typeA.localeCompare(typeB) || new Date(b.date) - new Date(a.date);
            }
            case 'category': {
                const catA = state.categories.find(c => c.id === a.Category);
                const catB = state.categories.find(c => c.id === b.Category);
                const orderA = catA ? (catA['index-order'] ?? 999) : 999;
                const orderB = catB ? (catB['index-order'] ?? 999) : 999;
                // Primary: Category Order, Secondary: Date
                if (orderA !== orderB) return orderA - orderB;
                return new Date(b.date) - new Date(a.date);
            }
            case 'amount-desc': return b.amount - a.amount;
            case 'amount-asc': return a.amount - b.amount;
            default: return new Date(b.date) - new Date(a.date);
        }
    });

    // Render mobile cards
    if (container) {
        container.innerHTML = filteredItems.map((item, index) => {
            const category = state.categories.find(c => c.id === item.Category);
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            const isMonthClosed = monthData.status === 'closed';
            const isRecurring = !!item.Model;
            return `
                <li class="p-4 flex items-center justify-between gap-4 group transaction-item-animate" style="animation-delay: ${index * 30}ms">
                    <div class="flex items-center gap-4 flex-grow truncate">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background-color: ${category?.color || '#94a3b8'}"><i class="fa-solid ${category?.icon || 'fa-question'}"></i></div>
                        <div class="flex-1 truncate">
                            <div class="flex items-center gap-2">
                                <p class="font-semibold text-slate-800 truncate">${item.label}</p>
                                ${isRecurring ? '<i class="fa-solid fa-arrows-rotate text-xs text-slate-400" title="Transaction récurrente"></i>' : ''}
                            </div>
                            <p class="text-xs text-slate-500 font-medium truncate">${txInfo.src.name} <i class="fa-solid fa-arrow-right mx-1 opacity-50"></i> ${txInfo.dst.name}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right whitespace-nowrap">
                            <p class="font-bold ${txInfo.ui.color}">${txInfo.ui.prefix || ''}${formatCurrency(item.amount)}</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${formatDateStr(item.date)}</p>
                        </div>
                        ${!isMonthClosed ? `
                        <button onclick="window.app.openMobileActions('${item.id}')" class="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Plus d'actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        ` : ''}
                    </div>
                </li>`;
        }).join('');
    }

    // Render desktop table
    if (tableBody) {
        tableBody.innerHTML = filteredItems.map((item, index) => {
            const category = state.categories.find(c => c.id === item.Category);
            const txInfo = getTxDisplayInfo(item.source, item.destination);
            const isMonthClosed = monthData.status === 'closed';
            const isRecurring = !!item.Model;
            return `
                <tr class="group hover:bg-slate-50 transition-colors transaction-item-animate" style="animation-delay: ${index * 20}ms">
                    <td class="px-6 py-4 text-sm text-slate-500 font-medium whitespace-nowrap">${formatDateStr(item.date)}</td>
                    <td class="px-6 py-4">
                        <span class="text-xs font-bold px-2 py-1 rounded-full ${txInfo.ui.color} bg-opacity-10" style="background-color: currentColor; background-clip: padding-box; color: inherit;">${getType(item)}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 text-xs" style="background-color: ${category?.color || '#94a3b8'}"><i class="fa-solid ${category?.icon || 'fa-question'}"></i></div>
                            <span class="text-sm font-medium text-slate-700">${category?.label || 'Sans catégorie'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-right whitespace-nowrap">
                        <span class="font-bold ${txInfo.ui.color}">${txInfo.ui.prefix || ''}${formatCurrency(item.amount)}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-semibold text-slate-800">${item.label}</span>
                            ${isRecurring ? '<i class="fa-solid fa-arrows-rotate text-[10px] text-slate-400" title="Transaction récurrente"></i>' : ''}
                        </div>
                        <div class="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            ${txInfo.src.name} <i class="fa-solid fa-arrow-right opacity-30"></i> ${txInfo.dst.name}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center justify-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            ${!isMonthClosed ? `
                            <button onclick="window.app.editTransaction('${item.id}')" class="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier"><i class="fa-solid fa-pen text-xs"></i></button>
                            <button onclick="window.app.deleteTransaction('${item.id}')" class="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Supprimer"><i class="fa-solid fa-trash text-xs"></i></button>

                            ` : ''}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }
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

    const savedSortOrder = localStorage.getItem('transactionSortOrder') || 'date-desc';
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

    const savingsBalance = state.accounts.filter(a => a.isSavings).reduce((sum, a) => sum + (balances[a.id] || 0), 0);
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
};

let googleChartsLoaded = false;
export const renderSankeyChart = (isExpanded = false) => {
    const containerId = isExpanded ? 'sankey-chart-expanded' : 'sankey-chart';
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!googleChartsLoaded) {
        if (typeof google === 'undefined') {
            container.innerHTML = 'Google Charts non chargé';
            return;
        }
        google.charts.load('current', {packages:['sankey']});
        google.charts.setOnLoadCallback(() => {
            googleChartsLoaded = true;
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
            colorsMap[labeledDest] = acc?.isSavings ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
        } else if (txInfo.isExpense) {
            const category = state.categories.find(c => c.id === item.Category);
            const catLabel = category ? category.label : 'Sans catégorie';
            
            const labeledSrc = getLabel(sourceName);
            const labeledDest = getLabel(catLabel);
            rows.push([labeledSrc, labeledDest, item.amount]);
            
            const acc = state.accounts.find(a => a.id === item.source);
            colorsMap[labeledSrc] = acc?.isSavings ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
            colorsMap[labeledDest] = category?.color || OTHER_COLOR;
        } else if (item.source && item.destination) {
            const destLabel = destName + ' (Épargne)';
            const labeledSrc = getLabel(sourceName);
            const labeledDest = getLabel(destLabel);
            rows.push([labeledSrc, labeledDest, item.amount]);
            
            const srcAcc = state.accounts.find(a => a.id === item.source);
            const dstAcc = state.accounts.find(a => a.id === item.destination);
            colorsMap[labeledSrc] = srcAcc?.isSavings ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
            colorsMap[labeledDest] = dstAcc?.isSavings ? SAVINGS_ACC_COLOR : CURRENT_ACC_COLOR;
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
    if (googleChartsLoaded && document.getElementById('sankey-chart')) {
        renderSankeyChart();
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
