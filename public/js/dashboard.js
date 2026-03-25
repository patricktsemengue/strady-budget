import { state } from './state.js';
import { formatCurrency, formatDateStr, getMonthKey, getTxDisplayInfo } from './utils.js';
import { currentUserId } from './storage.js';
import { updateMonthStatus, updateAccountInFirestore } from './firestore-service.js';
import { showNotification, render, setViewDate } from './ui.js';

export const getBalances = () => {
    let balances = {};
    state.accounts.forEach(a => { balances[a.id] = a.initialBalance || 0; });

    const currentMonthKey = getMonthKey(state.viewDate);
    Object.keys(state.records).sort().forEach(monthKey => {
        if (monthKey <= currentMonthKey && state.records[monthKey]) {
            state.records[monthKey].items.forEach(item => {
                if (item.source !== 'external' && item.source !== '' && balances[item.source] !== undefined) {
                    balances[item.source] -= item.amount;
                }
                if (item.destination !== 'external' && item.destination !== '' && balances[item.destination] !== undefined) {
                    balances[item.destination] += item.amount;
                }
            });
        }
    });
    return balances;
};

export const renderTransactions = () => {
    const container = document.getElementById('transactions-container');
    const categoryFilter = document.getElementById('filter-category').value;
    const accountFilter = document.getElementById('filter-account').value;
    const monthData = state.records[getMonthKey(state.viewDate)] || { items: [] };
    
    let filteredItems = monthData.items;
    if (categoryFilter !== 'all') filteredItems = filteredItems.filter(item => item.Category === categoryFilter);
    if (accountFilter !== 'all') filteredItems = filteredItems.filter(item => item.source === accountFilter || item.destination === accountFilter);

    // Sort by category label, then by date
    filteredItems.sort((a, b) => {
        const categoryA = state.categories.find(c => c.id === a.Category)?.label || '';
        const categoryB = state.categories.find(c => c.id === b.Category)?.label || '';
        const categoryCompare = categoryA.localeCompare(categoryB);
        if (categoryCompare !== 0) {
            return categoryCompare;
        }
        // If categories are the same, sort by date (most recent first)
        return new Date(b.date) - new Date(a.date);
    });

    container.innerHTML = filteredItems.map(item => {
        const category = state.categories.find(c => c.id === item.Category);
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        const isMonthClosed = monthData.status === 'closed';
        const isRecurring = !!item.Model;
        return `
            <li class="p-4 flex items-center gap-4 group">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white" style="background-color: ${category?.color || '#94a3b8'}"><i class="fa-solid ${category?.icon || 'fa-question'}"></i></div>
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <p class="font-semibold">${item.label}</p>
                        ${isRecurring ? '<i class="fa-solid fa-arrows-rotate text-xs text-slate-400" title="Transaction récurrente"></i>' : ''}
                    </div>
                    <p class="text-sm text-slate-500">${txInfo.src.name} -> ${txInfo.dst.name}</p>
                </div>
                <div class="text-right"><p class="font-bold ${txInfo.ui.color}">${txInfo.ui.prefix || ''}${formatCurrency(item.amount)}</p><p class="text-sm text-slate-500">${formatDateStr(item.date)}</p></div>
                <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                    ${!isMonthClosed ? `
                    <button onclick="window.app.editTransaction('${item.id}')" class="p-1 text-slate-500 hover:text-blue-600"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="window.app.duplicateTransaction('${item.id}')" class="p-1 text-slate-500 hover:text-green-600"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="window.app.deleteTransaction('${item.id}')" class="p-1 text-slate-500 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                    ` : ''}
                </div>
            </li>`;
    }).join('');
};

export const renderTimeline = () => {
    const container = document.getElementById('month-timeline');
    let html = '';
    for (let i = -12; i <= 12; i++) {
        const d = new Date(new Date().setMonth(new Date().getMonth() + i));
        const isSelected = d.getMonth() === state.viewDate.getMonth() && d.getFullYear() === state.viewDate.getFullYear();
        html += `<button onclick="window.app.setViewDate('${d.toISOString()}')" class="flex-none px-4 py-2 rounded-lg text-sm font-medium ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}">${new Intl.DateTimeFormat('fr-BE', { month: 'short', year: '2-digit' }).format(d)}</button>`;
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
        document.getElementById('anticipated-highlight').classList.add('hidden');
        return;
    }

    // Sort by date ascending
    allNonRecurring.sort((a, b) => new Date(a.date) - new Date(b.date));

    document.getElementById('anticipated-highlight').classList.remove('hidden');
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
    const select = document.getElementById('filter-category');
    if (!select) return;

    select.innerHTML = '<option value="all">Toutes les catégories</option>';
    for (const category of state.categories) {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.label;
        select.appendChild(option);
    }
};

export const populateAccountFilter = () => {
    const select = document.getElementById('filter-account');
    if (!select) return;

    select.innerHTML = '<option value="all">Tous les comptes</option>';
    for (const account of state.accounts) {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.name;
        select.appendChild(option);
    }
};

export const renderDashboard = () => {
    renderTimeline();
    
    const currentMonthKey = getMonthKey(state.viewDate);
    const currentMonthData = state.records[currentMonthKey] || { items: [], status: 'open' };

    const balances = getBalances();
    const totalBalance = Object.values(balances).reduce((sum, b) => sum + b, 0);
    document.getElementById('dash-total-balance').textContent = formatCurrency(totalBalance);

    let monthIncome = 0, monthExpense = 0;
    currentMonthData.items.forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        if (txInfo.isIncome) monthIncome += item.amount;
        else if (txInfo.isExpense) monthExpense += item.amount;
    });

    document.getElementById('dash-month-income').textContent = formatCurrency(monthIncome);
    document.getElementById('dash-month-expense').textContent = formatCurrency(monthExpense);

    const savingsBalance = state.accounts.filter(a => a.isSavings).reduce((sum, a) => sum + (balances[a.id] || 0), 0);
    const targetFund = monthExpense * 3;
    const progressPct = targetFund > 0 ? Math.min((savingsBalance / targetFund) * 100, 100) : 0;
    const isEmergencyOk = savingsBalance >= targetFund;
    document.getElementById('dash-emergency-fund').innerHTML = `
        <div class="flex items-baseline gap-2">
            <h2 class="text-3xl font-bold ${isEmergencyOk ? 'text-green-600' : 'text-amber-600'}">${formatCurrency(savingsBalance)}</h2>
            ${isEmergencyOk ? '<i class="fa-solid fa-check-circle text-green-500 text-xl"></i>' : ''}
        </div>
        <p class="text-xs text-slate-400 mt-1 mb-3">Objectif: ${formatCurrency(targetFund)}</p>
        <div class="w-full bg-slate-100 rounded-full h-2"><div class="${isEmergencyOk ? 'bg-green-500' : 'bg-amber-500'} h-full rounded-full" style="width: ${progressPct}%"></div></div>`;
    
    populateCategoryFilter();
    populateAccountFilter();
    renderTransactions();
    renderAnticipatedExpenses();

    const expensePercentage = monthIncome > 0 ? (monthExpense / monthIncome) * 100 : 0;
    document.getElementById('expense-percentage-bar').style.width = `${expensePercentage}%`;
    document.getElementById('expense-percentage-text').textContent = `${expensePercentage.toFixed(0)}%`;

    let nextMonthExpectedIncome = 0, nextMonthExpectedExpense = 0;
    const nextMonthKey = getMonthKey(new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1));
    (state.records[nextMonthKey]?.items || []).forEach(item => {
        const txInfo = getTxDisplayInfo(item.source, item.destination);
        if(txInfo.isIncome) nextMonthExpectedIncome += item.amount;
        if(txInfo.isExpense) nextMonthExpectedExpense += item.amount;
    });
    const forecastBalance = totalBalance + nextMonthExpectedIncome - nextMonthExpectedExpense;
    document.getElementById('forecast-balance').textContent = formatCurrency(forecastBalance);

    const clotureBtn = document.getElementById('btn-cloture');
    const isMonthClosed = currentMonthData.status === 'closed';
    clotureBtn.disabled = isMonthClosed;
    if(isMonthClosed) {
        clotureBtn.innerHTML = `<i class="fa-solid fa-lock mr-2"></i>Mois clôturé`;
    } else {
        clotureBtn.innerHTML = `<i class="fa-solid fa-lock-open mr-2"></i>Clôturer le mois`;
    }

    const addTxBtn = document.querySelector('button[onclick="window.app.openTransactionModal()"]');
    if (isMonthClosed) {
        document.getElementById('filter-category').disabled = true;
        document.getElementById('filter-account').disabled = true;
        if (addTxBtn) addTxBtn.disabled = true;
    } else {
        document.getElementById('filter-category').disabled = false;
        document.getElementById('filter-account').disabled = false;
        if (addTxBtn) addTxBtn.disabled = false;
    }
};

export const clotureMois = async () => {
    const currentMonthKey = getMonthKey(state.viewDate);
    if (state.records[currentMonthKey]?.status === 'closed') {
        showNotification('Ce mois est déjà clôturé.', 'error');
        return;
    }

    if (confirm(`Êtes-vous sûr de vouloir clôturer le mois de ${new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(state.viewDate)} ? Cette action est irréversible.`)) {
        try {
            const balances = getBalances();
            const updates = [];
            
            // Update all accounts with new initial balances based on the closed month
            state.accounts.forEach(acc => {
                const newBalance = balances[acc.id] || 0;
                updates.push(updateAccountInFirestore(currentUserId, { ...acc, initialBalance: newBalance }));
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
