import { state } from './state.js';
import { currentUserId } from './storage.js';
import { formatCurrency, formatDateStr, getMonthKey, getTxDisplayInfo, generateSparklineSVG } from './utils.js';
import { calculateBalances, calculateMonthlyIncome, calculateActualBurnRate } from './calculations.js';
import { showNotification } from './ui.js';
import { db } from './firestore-service.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const renderTransactions = () => {
    const desktopContainer = document.getElementById('transactions-table-body');
    const mobileContainer = document.getElementById('transactions-container');
    if (!desktopContainer && !mobileContainer) return;

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };
    
    // Nature Filtering
    const natureFilter = localStorage.getItem('strady_nature_filter') || 'ALL';
    let filteredItems = [...monthData.items];
    
    if (natureFilter !== 'ALL') {
        filteredItems = filteredItems.filter(tx => {
            const catId = tx.category || tx.Category;
            const cat = state.categories.find(c => c.id === catId);
            return cat && cat.nature === natureFilter;
        });
    }

    // Sort transactions by date (desc)
    const sortedTx = filteredItems.sort((a, b) => new Date(b.date || b.Date) - new Date(a.date || a.Date));

    // Calculate Totals for Stats Cards
    const inflows = sortedTx.reduce((sum, tx) => {
        const isIncome = !tx.source || tx.source === 'external';
        if (!isIncome) return sum;
        if (state.selectedEntityId === 'all' && tx.isInternalTransfer) return sum;
        const amount = tx.amount !== undefined ? tx.amount : tx.Amount;
        return sum + amount;
    }, 0);
    const outflows = sortedTx.reduce((sum, tx) => {
        const isExpense = !tx.destination || tx.destination === 'external';
        if (!isExpense) return sum;
        if (state.selectedEntityId === 'all' && tx.isInternalTransfer) return sum;
        const amount = tx.amount !== undefined ? tx.amount : tx.Amount;
        return sum + Math.abs(amount);
    }, 0);
    const net = inflows - outflows;

    // Update Desktop/Mobile Stats Cards
    const inEl = document.getElementById('desktop-stats-in');
    const outEl = document.getElementById('desktop-stats-out');
    const netEl = document.getElementById('desktop-stats-net');
    const stickyNetVal = document.getElementById('mobile-sticky-net-val');

    if (inEl) inEl.textContent = formatCurrency(inflows);
    if (outEl) outEl.textContent = formatCurrency(outflows);
    if (netEl) netEl.textContent = formatCurrency(net);
    if (stickyNetVal) stickyNetVal.textContent = formatCurrency(net);

    // Hybrid Sticky Observer
    const observer = new IntersectionObserver(([entry]) => {
        const stickyNet = document.getElementById('mobile-sticky-net');
        if (stickyNet) {
            if (!entry.isIntersecting) {
                stickyNet.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
            } else {
                stickyNet.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
            }
        }
    }, { threshold: 0.1 });

    const summaryCards = document.getElementById('financial-summary-cards');
    if (summaryCards) observer.observe(summaryCards);

    const noDataHtml = `
        <div class="flex flex-col items-center justify-center py-20 opacity-40">
            <i class="fa-solid fa-folder-open text-5xl mb-4"></i>
            <p class="font-black uppercase tracking-widest text-xs">Aucun flux ce mois-ci</p>
        </div>
    `;

    if (sortedTx.length === 0) {
        if (desktopContainer) desktopContainer.innerHTML = '<tr><td colspan="5">' + noDataHtml + '</td></tr>';
        if (mobileContainer) mobileContainer.innerHTML = noDataHtml;
        return;
    }

    const expandedStates = JSON.parse(localStorage.getItem('strady_expanded_categories') || '{}');

    // Group by category
    const grouped = sortedTx.reduce((acc, tx) => {
        const catId = tx.category || tx.Category || 'uncategorized';
        if (!acc[catId]) acc[catId] = [];
        acc[catId].push(tx);
        return acc;
    }, {});

    // Prepare 12-month sparkline data (6 past, current, 5 future)
    const pulseMonths = [];
    for (let i = -6; i <= 5; i++) {
        const d = new Date(Date.UTC(state.viewDate.getUTCFullYear(), state.viewDate.getUTCMonth() + i, 1));
        pulseMonths.push(getMonthKey(d));
    }

    const getCategoryTrend = (catId) => {
        return pulseMonths.map(mKey => {
            const mData = state.records[mKey] || { items: [] };
            return mData.items
                .filter(tx => (tx.category || tx.Category || 'uncategorized') === catId)
                .reduce((sum, tx) => {
                    const amount = tx.amount !== undefined ? tx.amount : tx.Amount;
                    const isExpense = !tx.destination || tx.destination === 'external';
                    return sum + (isExpense ? Math.abs(amount) : 0);
                }, 0);
        });
    };

    // Sort categories by volume
    const sortedCats = Object.entries(grouped).sort((a, b) => {
        const sumA = a[1].reduce((s, tx) => s + Math.abs(tx.amount || tx.Amount || 0), 0);
        const sumB = b[1].reduce((s, tx) => s + Math.abs(tx.amount || tx.Amount || 0), 0);
        return sumB - sumA;
    });

    // Render Desktop Table
    if (desktopContainer) {
        let dHtml = '';
        sortedCats.forEach(([catId, txs]) => {
            const category = state.categories.find(c => c.id === catId) || { label: 'Autre', icon: 'tag', color: 'slate' };
            const isExpanded = expandedStates[catId] !== false;
            const total = txs.reduce((s, tx) => s + (tx.amount || tx.Amount || 0), 0);
            const trendData = getCategoryTrend(catId);
            const sparkline = generateSparklineSVG(trendData, category.color);

            // Category Header Row
            dHtml += `
                <tr onclick="window.app.toggleCategoryGroup('${catId}')" class="bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors group">
                    <td colspan="3" class="py-3 px-6">
                        <div class="flex items-center gap-4">
                            <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-300 group-hover:text-indigo-500 transition-colors"></i>
                            <div class="w-8 h-8 rounded-lg bg-${category.color}-50 text-${category.color}-600 flex items-center justify-center text-xs">
                                <i class="fa-solid fa-${category.icon}"></i>
                            </div>
                            <span class="font-black text-slate-800 uppercase tracking-widest text-[10px]">${category.label || category.name}</span>
                            <div class="ml-2">${sparkline}</div>
                        </div>
                    </td>
                    <td class="py-3 px-6 text-right font-black text-sm ${total >= 0 ? 'text-emerald-600' : 'text-slate-900'}">
                        ${formatCurrency(total)}
                    </td>
                    <td class="py-3 px-6"></td>
                </tr>
            `;

            if (isExpanded) {
                txs.forEach(tx => {
                    const amount = tx.amount !== undefined ? tx.amount : tx.Amount;
                    const date = tx.date || tx.Date;
                    const label = tx.label || tx.Label;
                    const { ui } = getTxDisplayInfo(tx.source, tx.destination);

                    dHtml += `
                        <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                            <td class="py-3 px-6 text-[10px] font-bold text-slate-400 pl-16">${formatDateStr(date)}</td>
                            <td class="py-3 px-6">
                                <div class="flex items-center gap-3">
                                    <div class="w-6 h-6 rounded-md bg-slate-50 text-slate-400 flex items-center justify-center text-[10px]">
                                        <i class="fa-solid ${ui.icon}"></i>
                                    </div>
                                    <span class="font-bold text-slate-700 text-xs">${label}</span>
                                </div>
                            </td>
                            <td class="py-3 px-6"></td>
                            <td class="py-3 px-6 text-right font-bold text-xs ${amount >= 0 ? 'text-emerald-600' : 'text-slate-500'}">
                                ${formatCurrency(amount)}
                            </td>
                            <td class="py-3 px-6 text-right">
                                <div class="flex justify-end gap-1">
                                    <button onclick="window.app.editTransaction('${tx.id}')" class="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg"><i class="fa-solid fa-eye text-[10px]"></i></button>
                                    <button onclick="window.app.deleteTransaction('${tx.id}')" class="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
        });
        desktopContainer.innerHTML = dHtml;
    }

    // Render Mobile Cards
    if (mobileContainer) {
        let mHtml = '';
        sortedCats.forEach(([catId, txs]) => {
            const category = state.categories.find(c => c.id === catId) || { label: 'Autre', icon: 'tag', color: 'slate' };
            const isExpanded = expandedStates[catId] !== false;
            const total = txs.reduce((s, tx) => s + (tx.amount || tx.Amount || 0), 0);
            const trendData = getCategoryTrend(catId);
            const sparkline = generateSparklineSVG(trendData, category.color);

            mHtml += `
                <div class="mb-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                    <button onclick="window.app.toggleCategoryGroup('${catId}')" class="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-2xl bg-${category.color}-50 text-${category.color}-600 flex items-center justify-center text-lg">
                                <i class="fa-solid fa-${category.icon}"></i>
                            </div>
                            <div class="text-left">
                                <div class="flex items-center gap-2">
                                    <h3 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">${category.label || category.name}</h3>
                                    ${sparkline}
                                </div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">${txs.length} flux</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="font-black text-sm ${total >= 0 ? 'text-emerald-500' : 'text-slate-700'}">${formatCurrency(total)}</span>
                            <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-300"></i>
                        </div>
                    </button>
                    <div class="${isExpanded ? '' : 'hidden'} border-t border-slate-50">
                        ${txs.map(tx => {
                            const amount = tx.amount !== undefined ? tx.amount : tx.Amount;
                            const date = tx.date || tx.Date;
                            const label = tx.label || tx.Label;
                            const { ui } = getTxDisplayInfo(tx.source, tx.destination);
                            return `
                                <div onclick="window.app.openMobileActions('${tx.id}')" class="px-6 py-4 flex items-center justify-between border-b last:border-b-0 border-slate-50 active:bg-slate-50 transition-colors">
                                    <div class="flex items-center gap-4">
                                        <div class="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center text-xs">
                                            <i class="fa-solid ${ui.icon}"></i>
                                        </div>
                                        <div>
                                            <p class="font-bold text-slate-700 text-xs">${label}</p>
                                            <p class="text-[9px] font-bold text-slate-400 uppercase">${formatDateStr(date)}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-4">
                                        <span class="font-bold text-xs ${amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${formatCurrency(amount)}</span>
                                        <button class="p-2 text-slate-400"><i class="fa-solid fa-ellipsis-vertical text-[10px]"></i></button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        mobileContainer.innerHTML = mHtml;
    }
};

export const renderSankeyChart = (isExpanded = false) => {
    const containerId = isExpanded ? 'sankey-chart-expanded' : 'sankey-chart';
    const container = document.getElementById(containerId);
    if (!container) return;

    if (typeof google === 'undefined' || !google.visualization || !google.visualization.Sankey) {
        if (typeof google !== 'undefined' && google.charts) {
            google.charts.load('current', { packages: ['sankey'] });
            google.charts.setOnLoadCallback(() => renderSankeyChart(isExpanded));
        }
        return;
    }

    const monthKey = getMonthKey(state.viewDate);
    const monthData = state.records[monthKey] || { items: [] };

    const rows = [];
    const flowMap = new Map();

    const addFlow = (from, to, amount) => {
        if (amount <= 0) return;
        const key = `${from}|${to}`;
        flowMap.set(key, (flowMap.get(key) || 0) + amount);
    };

    monthData.items.forEach(tx => {
        const amount = Math.abs(tx.amount !== undefined ? tx.amount : tx.Amount);
        const txInfo = getTxDisplayInfo(tx.source, tx.destination);
        const catId = tx.category || tx.Category;
        const category = state.categories.find(c => c.id === catId) || { label: 'Autre' };
        const catName = category.label || category.name;

        if (txInfo.isIncome) {
            addFlow('Revenus', txInfo.dst.name, amount);
        } else if (txInfo.isExpense) {
            addFlow(txInfo.src.name, catName, amount);
        } else {
            // Internal Transfer
            addFlow(txInfo.src.name, txInfo.dst.name, amount);
        }
    });

    flowMap.forEach((val, key) => {
        const [from, to] = key.split('|');
        if (from === to) return; // Skip self-loops
        rows.push([from, to, val]);
    });

    if (rows.length === 0) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 italic">Aucune donnée de flux pour ce mois</div>';
        return;
    }

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Weight');
    data.addRows(rows);

    const colors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
    const options = {
        sankey: {
            node: {
                colors: colors,
                label: { fontName: 'Inter', fontSize: 12, fontWeight: 'bold', color: '#1e293b' },
                interactivity: true,
                width: 15,
                nodePadding: 30
            },
            link: {
                colorMode: 'gradient',
                colors: colors
            }
        },
        backgroundColor: 'transparent'
    };

    const chart = new google.visualization.Sankey(container);
    chart.draw(data, options);
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
        const catId = item.category || item.Category || 'uncategorized';
        groups[catId] = expand;
    });

    localStorage.setItem('strady_expanded_categories', JSON.stringify(groups));
    renderTransactions();
};

export const setNatureFilter = (nature) => {
    localStorage.setItem('strady_nature_filter', nature);
    
    // Update active UI state for pills
    document.querySelectorAll('.nature-pill').forEach(btn => {
        const isMatch = btn.dataset.nature === nature;
        btn.classList.toggle('active', isMatch);
        btn.classList.toggle('bg-slate-800', isMatch);
        btn.classList.toggle('text-white', isMatch);
        btn.classList.toggle('bg-white', !isMatch);
        btn.classList.toggle('border', !isMatch);
        btn.classList.toggle('border-slate-200', !isMatch);
        btn.classList.toggle('text-slate-500', !isMatch);
    });

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

    // Get all recurring templates filtered by entity
    const recurring = (state.recurringTemplates || []).filter(tpl => state.selectedEntityId === 'all' || tpl.entityId === state.selectedEntityId);
    
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

    const filteredAccounts = state.accounts.filter(acc => state.selectedEntityId === 'all' || acc.entityId === state.selectedEntityId);
    const sortedAccounts = [...filteredAccounts].sort((a, b) => a.name.localeCompare(b.name));

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
                const accRef = doc(db, `users/${currentUserId}/accounts`, acc.id);
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
