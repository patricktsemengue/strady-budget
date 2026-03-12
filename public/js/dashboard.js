import { state } from './state.js';
import { formatCurrency, formatDateStr, getMonthKey, getTxDisplayInfo } from './utils.js';
import { saveState } from './storage.js';
import { showNotification, render, setViewDate } from './ui.js';

export const getBalances = () => {
    let balances = {};
    state.accounts.forEach(a => { balances[a.id] = a.initialBalance || 0; });

    const currentMonthKey = getMonthKey(state.viewDate);
    Object.keys(state.records).sort().forEach(monthKey => {
        if (monthKey <= currentMonthKey && state.records[monthKey]) {
            state.records[monthKey].items.forEach(item => {
                if (item.sourceId !== 'external' && balances[item.sourceId] !== undefined) {
                    balances[item.sourceId] -= item.amount;
                }
                if (item.destinationId !== 'external' && balances[item.destinationId] !== undefined) {
                    balances[item.destinationId] += item.amount;
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
    if (categoryFilter !== 'all') filteredItems = filteredItems.filter(item => item.category === categoryFilter);
    if (accountFilter !== 'all') filteredItems = filteredItems.filter(item => item.sourceId === accountFilter || item.destinationId === accountFilter);

    container.innerHTML = filteredItems.map(item => {
        const category = state.categories.find(c => c.id === item.category);
        const txInfo = getTxDisplayInfo(item.sourceId, item.destinationId);
        const isMonthClosed = monthData.status === 'closed';
        return `
            <li class="p-4 flex items-center gap-4 group">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white" style="background-color: ${category?.color || '#94a3b8'}"><i class="fa-solid ${category?.icon || 'fa-question'}"></i></div>
                <div class="flex-1"><p class="font-semibold">${item.label}</p><p class="text-sm text-slate-500">${txInfo.src.name} -> ${txInfo.dst.name}</p></div>
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
    const nextMonthKey = getMonthKey(new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1));
    const anticipatedList = document.getElementById('anticipated-list');
    const nonRecurring = (state.records[nextMonthKey]?.items || []).filter(item => !item.isRecurringInst && getTxDisplayInfo(item.sourceId, item.destinationId).isExpense);

    if(nonRecurring.length === 0) {
        document.getElementById('anticipated-highlight').classList.add('hidden');
        return;
    }
    document.getElementById('anticipated-highlight').classList.remove('hidden');
    anticipatedList.innerHTML = nonRecurring.map(item => `
        <div class="bg-white/60 rounded-lg p-3 border border-amber-100 flex justify-between items-center shadow-sm">
            <div class="truncate pr-2"><div class="font-medium text-amber-900">${item.label}</div><div class="text-xs text-amber-600 font-semibold"><i class="fa-regular fa-calendar mr-1"></i>${formatDateStr(item.date)}</div></div>
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
        const txInfo = getTxDisplayInfo(item.sourceId, item.destinationId);
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
        const txInfo = getTxDisplayInfo(item.sourceId, item.destinationId);
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

export const clotureMois = () => {
    const currentMonthKey = getMonthKey(state.viewDate);
    if (state.records[currentMonthKey]?.status === 'closed') {
        showNotification('Ce mois est déjà clôturé.', 'error');
        return;
    }

    if (confirm(`Êtes-vous sûr de vouloir clôturer le mois de ${new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(state.viewDate)} ? Cette action est irréversible.`)) {
        const balances = getBalances();
        
        state.accounts.forEach(acc => {
            acc.initialBalance = balances[acc.id] || 0;
        });

        if(!state.records[currentMonthKey]) {
            state.records[currentMonthKey] = { items: [], status: 'open' };
        }
        state.records[currentMonthKey].status = 'closed';

        Object.keys(state.records).sort().forEach(monthKey => {
            if (monthKey < currentMonthKey && state.records[monthKey].status !== 'closed') {
                state.records[monthKey].status = 'closed';
            }
        });

        saveState();
        render();
        showNotification('Mois clôturé avec succès. Les soldes initiaux du mois suivant ont été mis à jour.');
    }
};
