import { state } from './state.js';
import { t } from './i18n.js';
import { formatCurrency, getMonthKey } from './utils.js';

/**
 * Renders the Yearly Pulse view.
 * Aggregates 12 months of category data (2 past, current, 9 future).
 */
export function renderYearlyPulse() {
    const container = document.getElementById('yearly-pulse-content');
    if (!container) return;

    // 1. Identify 36 months centered around the global viewDate
    const months = [];
    const centerDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1);
    
    // We show 12 past, current, and 23 future relative to selected month
    for (let i = -12; i <= 23; i++) {
        const d = new Date(centerDate.getFullYear(), centerDate.getMonth() + i, 1);
        months.push({
            date: d,
            key: getMonthKey(d),
            isCurrent: i === 0,
            label: new Intl.DateTimeFormat(navigator.language, { month: 'short' }).format(d)
        });
    }

    // 1.1 Group months by Year for the header
    const yearGroups = [];
    months.forEach(m => {
        const year = m.date.getFullYear();
        const lastGroup = yearGroups[yearGroups.length - 1];
        if (!lastGroup || lastGroup.year !== year) {
            yearGroups.push({ year, count: 1 });
        } else {
            lastGroup.count++;
        }
    });

    // 2. Aggregate data from state.records for each category
    const categories = [...state.categories];
    // Sort categories by index-order if available
    categories.sort((a, b) => {
        const orderA = a['index-order'] !== undefined ? a['index-order'] : Infinity;
        const orderB = b['index-order'] !== undefined ? b['index-order'] : Infinity;
        return orderA - orderB;
    });

    const data = {}; // categoryId -> monthKey -> amount

    months.forEach(m => {
        const monthItems = state.records[m.key]?.items || [];
        categories.forEach(cat => {
            if (!data[cat.id]) data[cat.id] = {};
            
            const catAmount = monthItems
                .filter(tx => {
                    const isCatMatch = tx.categoryId === cat.id || tx.Category === cat.id;
                    const shouldCount = state.selectedEntityId === 'all' ? !tx.isInternalTransfer : true;
                    return isCatMatch && shouldCount;
                })
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            data[cat.id][m.key] = catAmount;
        });
    });

    // 3. Render table
    let html = `
        <!-- Month Indicator (Mobile only) -->
        <div class="flex md:hidden sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-100 dark:border-slate-800 mb-4 py-3 px-4 rounded-2xl shadow-sm gap-2 items-center justify-center">
            ${Array.from({ length: 12 }).map((_, idx) => `
                <div id="month-dot-${idx}" class="month-indicator-dot shrink-0 w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"></div>
            `).join('')}
        </div>

        <div class="yearly-pulse-container overflow-x-auto shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hide-scroll">
            <table class="yearly-pulse-table w-full text-left border-collapse min-w-[3800px]">
                <thead>
                    <tr class="bg-slate-50/50 dark:bg-slate-800/50">
                        <th class="yearly-pulse-sidebar sticky left-0 top-0 z-50 bg-slate-50 dark:bg-slate-800 p-2 border-b border-r border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400 w-56 h-[32px]">
                        </th>
                        ${yearGroups.map(yg => `
                            <th colspan="${yg.count}" class="p-2 border-b border-slate-200 dark:border-slate-700 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 z-40 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md">
                                ${yg.year}
                            </th>
                        `).join('')}
                    </tr>
                    <tr class="bg-slate-50/50 dark:bg-slate-800/50">
                        <th class="yearly-pulse-sidebar sticky left-0 top-[32px] z-50 bg-slate-50 dark:bg-slate-800 p-4 border-b border-r border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-500 w-56 h-[49px]">
                            ${t('common.category')}
                        </th>
                        ${months.map(m => `
                            <th class="yearly-pulse-month-col p-4 border-b border-slate-200 dark:border-slate-700 text-center text-[11px] font-black uppercase tracking-widest sticky top-[32px] z-40 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md ${m.isCurrent ? 'text-violet-600 bg-violet-50/50 dark:bg-violet-900/20 is-current' : 'text-slate-500'}">
                                ${m.label}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
    `;

    // Group categories by Nature
    const natureOrder = ['REVENU', 'EPARGNE', 'FIXE', 'QUOTIDIEN', 'LOISIR'];
    const naturesFound = [...new Set(categories.map(c => c.nature || 'QUOTIDIEN'))];
    const sortedNatures = natureOrder.filter(n => naturesFound.includes(n));
    // Add any missing natures at the end
    naturesFound.forEach(n => {
        if (!sortedNatures.includes(n)) sortedNatures.push(n);
    });

    sortedNatures.forEach(nature => {
        const cats = categories.filter(c => (c.nature || 'QUOTIDIEN') === nature);
        if (cats.length === 0) return;

        const natureLabel = t(`nature.${nature}`) || nature;

        html += `
            <tr class="bg-slate-50/30 dark:bg-slate-800/30">
                <td colspan="${months.length + 1}" class="sticky left-0 z-10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/30 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800">
                    ${natureLabel}
                </td>
            </tr>
        `;
        
        cats.forEach(cat => {
            html += `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td class="yearly-pulse-sidebar sticky left-0 z-10 bg-white dark:bg-slate-900 p-4 border-r border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors">
                        <div class="flex flex-col md:flex-row items-center gap-1 md:gap-3">
                            <div class="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm" style="background-color: ${cat.color || '#cbd5e1'}">
                                <i class="fa-solid ${cat.icon || 'fa-tag'} text-[10px]"></i>
                            </div>
                            <span class="text-[11px] md:text-xs font-bold text-slate-700 dark:text-slate-300 truncate text-center md:text-left">${cat.label}</span>
                        </div>
                    </td>
                    ${months.map(m => {
                        const val = data[cat.id][m.key];
                        const isZero = !val || val === 0;
                        const colorClass = nature === 'REVENU' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200';
                        
                        return `
                            <td class="yearly-pulse-month-col p-4 text-center text-xs ${m.isCurrent ? 'bg-violet-50/10 dark:bg-violet-900/5 font-black ring-1 ring-inset ring-violet-100 dark:ring-violet-900/30' : ''} ${isZero ? 'text-slate-300 dark:text-slate-600 font-normal' : 'font-bold ' + colorClass}">
                                ${isZero ? '—' : formatCurrency(val)}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        });
    });

    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-4 flex items-center gap-4 text-[10px] text-slate-400 font-medium italic">
            <i class="fa-solid fa-circle-info text-violet-400"></i>
            <p>${t('yearly_pulse.hint') || 'Faites défiler horizontalement pour voir toute l’année.'}</p>
        </div>
    `;

    container.innerHTML = html;

    // --- Mobile Snap & Indicator Logic ---
    const scrollContainer = container.querySelector('.yearly-pulse-container');
    const dots = container.querySelectorAll('.month-indicator-dot');

    if (scrollContainer) {
        // Navigation Buttons
        const prevBtn = document.getElementById('prev-month-btn');
        const nextBtn = document.getElementById('next-month-btn');
        
        const scrollByMonth = (direction) => {
            const firstCol = scrollContainer.querySelector('.yearly-pulse-month-col');
            if (firstCol) {
                const monthWidth = firstCol.offsetWidth;
                scrollContainer.scrollBy({ left: direction * monthWidth, behavior: 'smooth' });
            }
        };

        if (prevBtn) prevBtn.onclick = () => scrollByMonth(-1);
        if (nextBtn) nextBtn.onclick = () => scrollByMonth(1);

        // Jump to Today Functionality (Updates Global State)
        const jumpBtn = document.getElementById('jump-to-today-btn');
        if (jumpBtn) {
            jumpBtn.onclick = () => {
                if (window.app && window.app.setViewDate) {
                    window.app.setViewDate(new Date().toISOString());
                }
            };
        }

        // Internal Centering (Visual Only)
        const centerOnCurrent = () => {
            const currentMonthCol = scrollContainer.querySelector('.is-current');
            if (currentMonthCol) {
                currentMonthCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        };

        if (dots.length > 0) {
            let cachedScrollWidth = scrollContainer.scrollWidth;
            let cachedClientWidth = scrollContainer.clientWidth;
            let ticking = false;

            const updateCachedLayout = () => {
                cachedScrollWidth = scrollContainer.scrollWidth;
                cachedClientWidth = scrollContainer.clientWidth;
            };

            // Use ResizeObserver to update cached values only when layout changes
            const resizeObserver = new ResizeObserver(() => {
                updateCachedLayout();
                requestUpdateDots();
            });
            resizeObserver.observe(scrollContainer);

            const updateDots = () => {
                const scrollLeft = scrollContainer.scrollLeft;
                const maxScroll = cachedScrollWidth - cachedClientWidth;
                
                // We have 12 dots (pips) representing the 36-month timeline
                const percentage = maxScroll > 0 ? scrollLeft / maxScroll : 0;
                const activeIndex = Math.min(11, Math.round(percentage * 11));
                
                dots.forEach((dot, idx) => {
                    const isActive = idx === activeIndex;
                    if (isActive && !dot.classList.contains('active')) {
                        dot.classList.add('active', 'bg-violet-500');
                        dot.classList.remove('bg-slate-200', 'dark:bg-slate-700');
                    } else if (!isActive && dot.classList.contains('active')) {
                        dot.classList.remove('active', 'bg-violet-500');
                        dot.classList.add('bg-slate-200', 'dark:bg-slate-700');
                    }
                });
                ticking = false;
            };

            const requestUpdateDots = () => {
                if (!ticking) {
                    requestAnimationFrame(updateDots);
                    ticking = true;
                }
            };

            scrollContainer.addEventListener('scroll', requestUpdateDots);
            
            // Initial position & dot update
            setTimeout(() => {
                centerOnCurrent();
                updateCachedLayout();
                requestUpdateDots();
            }, 100);
        }
    }
}
