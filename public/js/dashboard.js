import { state } from './state.js';
import { formatCurrency, formatDateStr, getMonthKey, getTxDisplayInfo } from './utils.js';
import { calculateBalances, calculateMonthlyIncome, calculateActualBurnRate } from './calculations.js';
import { showNotification } from './ui.js';
import { db } from './firestore-service.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const renderTransactions = () => {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };
    
    // Sort transactions by date (desc)
    const sortedTx = [...monthData.items].sort((a, b) => new Date(b.Date) - new Date(a.Date));

    if (sortedTx.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 opacity-40">
                <i class="fa-solid fa-folder-open text-5xl mb-4"></i>
                <p class="font-black uppercase tracking-widest text-xs">Aucun flux ce mois-ci</p>
            </div>
        `;
        return;
    }

    const expandedStates = JSON.parse(localStorage.getItem('strady_expanded_categories') || '{}');

    // Group by category
    const grouped = sortedTx.reduce((acc, tx) => {
        const catId = tx.Category || 'uncategorized';
        if (!acc[catId]) acc[catId] = [];
        acc[catId].push(tx);
        return acc;
    }, {});

    let html = '';
    
    // Sort categories by volume (total absolute amount)
    const sortedCats = Object.entries(grouped).sort((a, b) => {
        const sumA = a[1].reduce((s, tx) => s + Math.abs(tx.Amount), 0);
        const sumB = b[1].reduce((s, tx) => s + Math.abs(tx.Amount), 0);
        return sumB - sumA;
    });

    sortedCats.forEach(([catId, txs]) => {
        const category = state.categories.find(c => c.id === catId) || { name: 'Autre', icon: 'tag', color: 'slate' };
        const isExpanded = expandedStates[catId] !== false;
        const total = txs.reduce((s, tx) => s + tx.Amount, 0);

        html += `
            <div class="mb-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <!-- Category Header -->
                <button onclick="window.app.toggleCategoryGroup('${catId}')" class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-2xl bg-${category.color}-50 dark:bg-${category.color}-900/20 text-${category.color}-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-${category.icon}"></i>
                        </div>
                        <div class="text-left">
                            <h3 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">${category.name}</h3>
                            <p class="text-[9px] font-bold text-slate-400 uppercase">${txs.length} flux</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="font-black text-sm ${total >= 0 ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}">${formatCurrency(total)}</span>
                        <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-300"></i>
                    </div>
                </button>

                <!-- Transactions List -->
                <div class="${isExpanded ? '' : 'hidden'} border-t border-slate-50 dark:border-slate-800/50">
                    ${txs.map(tx => {
                        const { icon, color, label } = getTxDisplayInfo(tx);
                        return `
                            <div class="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 group transition-colors border-b last:border-b-0 border-slate-50 dark:border-slate-800/30">
                                <div class="flex items-center gap-4">
                                    <div class="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-xs group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                                        <i class="fa-solid fa-${icon}"></i>
                                    </div>
                                    <div>
                                        <p class="font-bold text-slate-700 dark:text-slate-200 text-xs">${tx.Label}</p>
                                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">${formatDateStr(tx.Date)}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-4">
                                    <span class="font-bold text-xs ${tx.Amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${formatCurrency(tx.Amount)}</span>
                                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="window.app.editTransaction('${tx.id}')" class="p-2 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
                                            <i class="fa-solid fa-pen text-[10px]"></i>
                                        </button>
                                        <button onclick="window.app.deleteTransaction('${tx.id}')" class="p-2 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
                                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
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
    const globalContainer = document.getElementById('month-timeline-global');
    const puckTimeline = document.getElementById('puck-timeline');
    
    if (!globalContainer && !puckTimeline) return;

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    // 1. Render Mobile Nav Puck (3 centered months)
    if (puckTimeline && window.innerWidth < 768) {
        const isCurrentlyHome = (state.viewDate.getUTCMonth() === currentMonth && state.viewDate.getUTCFullYear() === currentYear);
        
        // Update Today Button Style
        const puckToday = document.getElementById('puck-today');
        if (puckToday) {
            if (isCurrentlyHome) {
                puckToday.classList.remove('text-indigo-500', 'bg-indigo-50');
                puckToday.classList.add('text-slate-300', 'opacity-50');
                puckToday.disabled = true;
            } else {
                puckToday.classList.add('text-indigo-500');
                puckToday.classList.remove('text-slate-300', 'opacity-50');
                puckToday.disabled = false;
            }
        }

        let pHtml = '';
        const monthsToShow = [];
        for (let i = -1; i <= 1; i++) {
            monthsToShow.push(new Date(Date.UTC(state.viewDate.getUTCFullYear(), state.viewDate.getUTCMonth() + i, 1)));
        }

        monthsToShow.forEach(mCur => {
            const isSelected = (mCur.getUTCMonth() === state.viewDate.getUTCMonth() && mCur.getUTCFullYear() === state.viewDate.getUTCFullYear());
            const isToday = (mCur.getUTCMonth() === currentMonth && mCur.getUTCFullYear() === currentYear);

            let label = new Intl.DateTimeFormat('fr-BE', { month: 'short', timeZone: 'UTC' }).format(mCur).replace('.', '');
            const yrLabel = mCur.getUTCFullYear().toString().slice(-2);
            
            let bgClass = isSelected 
                ? 'bg-indigo-600 text-white shadow-lg scale-110 z-10' 
                : 'bg-transparent text-slate-500 dark:text-slate-400';

            const action = isSelected ? 'window.app.openMatrixCalendar()' : `window.app.setViewDate('${mCur.toISOString()}')`;

            pHtml += `
                <button onclick="${action}" 
                        class="px-4 h-10 rounded-full transition-all duration-300 flex items-center justify-center gap-0.5 relative ${bgClass}">
                    <span class="uppercase font-black text-[10px]">${label}</span>
                    <span class="text-[7px] opacity-50 font-bold">${yrLabel}</span>
                    ${isToday && !isSelected ? '<div class="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"></div>' : ''}
                </button>
            `;
        });
        puckTimeline.innerHTML = pHtml;
    }

    // 2. Render Global Top Bar (Responsive Stream - Desktop Only)
    if (globalContainer && window.innerWidth >= 768) {
        // Update Year Display
        const yearDisplay = document.getElementById('current-year-display');
        if (yearDisplay) yearDisplay.textContent = state.viewDate.getUTCFullYear();

        let gHtml = '';
        const monthsToShow = [];
        for (let i = -2; i <= 2; i++) {
            monthsToShow.push(new Date(Date.UTC(state.viewDate.getUTCFullYear(), state.viewDate.getUTCMonth() + i, 1)));
        }

        monthsToShow.forEach(mCur => {
            const isSelected = (mCur.getUTCMonth() === state.viewDate.getUTCMonth() && mCur.getUTCFullYear() === state.viewDate.getUTCFullYear());
            const isToday = (mCur.getUTCMonth() === currentMonth && mCur.getUTCFullYear() === currentYear);

            let label = new Intl.DateTimeFormat('fr-BE', { month: 'short', timeZone: 'UTC' }).format(mCur).replace('.', '');
            const yrLabel = mCur.getUTCFullYear().toString().slice(-2);
            
            const labelHtml = `<span class="uppercase font-black text-[9px]">${label}</span><span class="text-[7px] opacity-50 font-bold ml-0.5">${yrLabel}</span>`;

            let bgClass = isSelected ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50';

            gHtml += `
                <button onclick="window.app.setViewDate('${mCur.toISOString()}')" 
                        class="flex-1 px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-0.5 relative ${bgClass}">
                    ${labelHtml}
                    ${isToday && !isSelected ? '<div class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"></div>' : ''}
                </button>
            `;
        });
        globalContainer.innerHTML = gHtml;
    }
};

export const renderMatrixCalendar = (year = null) => {
    const grid = document.getElementById('matrix-calendar-grid');
    const label = document.getElementById('matrix-year-label');
    if (!grid) return;

    const targetYear = year || state.viewDate.getUTCFullYear();
    if (label) label.textContent = `Année ${targetYear}`;

    let html = '';
    const currentMonth = new Date().getUTCMonth();
    const currentYear = new Date().getUTCFullYear();

    for (let i = 0; i < 12; i++) {
        const date = new Date(Date.UTC(targetYear, i, 1));
        const isSelected = (i === state.viewDate.getUTCMonth() && targetYear === state.viewDate.getUTCFullYear());
        const isToday = (i === currentMonth && targetYear === currentYear);
        
        const monthName = new Intl.DateTimeFormat('fr-BE', { month: 'long', timeZone: 'UTC' }).format(date);
        
        const bgClass = isSelected 
            ? 'bg-indigo-600 text-white shadow-md' 
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800';

        html += `
            <button onclick="window.app.setViewDate('${date.toISOString()}'); document.getElementById('matrix-calendar-modal').classList.add('hidden')" 
                    class="py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative ${bgClass}">
                ${monthName}
                ${isToday && !isSelected ? '<div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"></div>' : ''}
            </button>
        `;
    }
    grid.innerHTML = html;

    // Track the year being viewed in the matrix for prev/next buttons
    grid.dataset.viewYear = targetYear;
};

export const renderAnticipatedExpenses = () => {
    const container = document.getElementById('anticipated-list');
    if (!container) return;

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };

    // Get all recurring templates
    const recurring = state.recurringTemplates || [];
    
    // Check which ones are NOT in the current month's transactions
    const missing = recurring.filter(template => {
        return !monthData.items.some(tx => tx.RecurringTemplateId === template.id);
    });

    if (missing.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Tout est à jour</div>`;
        return;
    }

    container.innerHTML = missing.map(item => `
        <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 text-amber-500 flex items-center justify-center shadow-sm">
                    <i class="fa-solid fa-clock-rotate-left text-xs"></i>
                </div>
                <div>
                    <p class="font-bold text-slate-700 dark:text-slate-200 text-xs">${item.label}</p>
                    <p class="text-[9px] font-black text-slate-400 uppercase">${item.frequency || 'Mensuel'}</p>
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
        
        state.categories.sort((a, b) => a.name.localeCompare(b.name)).forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
        
        if (currentVal) select.value = currentVal;
    });
};

export const populateAccountFilter = () => {
    const selects = [document.getElementById('filter-account'), document.getElementById('filter-account-mobile')];
    
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="all">Tous les comptes</option>';
        
        state.accounts.sort((a, b) => a.name.localeCompare(b.name)).forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = acc.name;
            select.appendChild(option);
        });
        
        if (currentVal) select.value = currentVal;
    });
};

export const renderAccountsList = () => {
    const container = document.getElementById('accounts-list');
    if (!container) return;

    const sortedAccounts = [...state.accounts].sort((a, b) => a.name.localeCompare(b.name));

    if (sortedAccounts.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 opacity-40">
                <i class="fa-solid fa-building-columns text-5xl mb-4"></i>
                <p class="font-black uppercase tracking-widest text-xs">Aucun compte configuré</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sortedAccounts.map(acc => {
        const balance = state.accountBalances[acc.id] || 0;
        return `
            <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-indigo-100 dark:hover:border-indigo-900 transition-all">
                <div class="flex items-center gap-5">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-building-columns"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">${acc.name}</h3>
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">${acc.is_savings ? 'Épargne de précaution' : (acc.is_investment ? 'Investissement' : 'Trésorerie courante')}</p>
                    </div>
                </div>
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <p class="font-black text-lg text-slate-800 dark:text-white">${formatCurrency(balance)}</p>
                        ${acc.balanceDirty ? '<span class="text-[8px] font-black text-amber-500 uppercase tracking-widest">Mise à jour requise</span>' : ''}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.app.openAdjustmentModal('${acc.id}')" class="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="Ajuster le solde">
                            <i class="fa-solid fa-scale-balanced"></i>
                        </button>
                        <button onclick="window.app.openAccountActions('${acc.id}')" class="p-3 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

export const closeMonth = async () => {
    if (confirm("Voulez-vous clôturer ce mois ? Cela mettra à jour les soldes initiaux du mois suivant.")) {
        try {
            const nextMonth = new Date(Date.UTC(state.viewDate.getUTCFullYear(), state.viewDate.getUTCMonth() + 1, 1));
            const updates = state.accounts.map(acc => {
                const balance = state.accountBalances[acc.id] || 0;
                const accRef = doc(db, `users/${state.user.uid}/accounts`, acc.id);
                return updateDoc(accRef, {
                    [`monthly_initial_balances.${getMonthKey(nextMonth)}`]: balance
                });
            });

            await Promise.all(updates);
            
            showNotification('Mois clôturé avec succès. Les soldes initiaux ont été mis à jour.');
        } catch (err) {
            showNotification('Erreur lors de la clôture', 'error');
        }
    }
};
