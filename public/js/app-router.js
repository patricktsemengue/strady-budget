import { state, updateState } from './state.js';
import { markAccountsBalanceDirty } from './firestore-service.js';
import { currentUserId } from './storage.js';

class AppRouter {
    constructor() {
        this.modules = {};
        this.currentModule = null;
        this.navContainer = null;
        this.mobileNavContainer = null;
    }

    setNavContainers(desktopId, mobileId) {
        this.navContainer = document.getElementById(desktopId);
        this.mobileNavContainer = document.getElementById(mobileId);
    }

    register(module) {
        this.modules[module.id] = module;
        this.updateNav();
        if (module.init) {
            module.init();
        }
    }

    updateNav() {
        if (!this.navContainer) return;

        const modulesByGroup = {};
        Object.values(this.modules)
            .filter(m => !m.hidden)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .forEach(m => {
                const group = m.group || 'AUTRES';
                if (!modulesByGroup[group]) modulesByGroup[group] = [];
                modulesByGroup[group].push(m);
            });

        const buildDesktopNav = () => {
            let html = '';
            Object.entries(modulesByGroup).forEach(([groupName, items], groupIdx) => {
                // Group Container
                html += `<div class="flex items-center group/nav-section">`;
                
                // Group Label (Vertical or Small lead)
                html += `
                    <div class="flex flex-col justify-center px-3 border-l first:border-l-0 border-slate-200 h-8">
                        <span class="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">${groupName.split(' ')[0]}</span>
                        <span class="text-[8px] font-black text-slate-300 uppercase tracking-tighter leading-none">${groupName.split(' ')[1] || ''}</span>
                    </div>
                `;

                items.forEach(m => {
                    const id = `nav-${m.id}`;
                    html += `<button id="${id}" class="px-4 h-12 border-b-2 border-transparent flex items-center text-[10px] font-black uppercase tracking-widest transition-all hover:text-indigo-600">
                        <i class="fa-solid ${m.icon} mr-2 text-slate-400"></i>${m.label}
                    </button>`;
                });

                html += `</div>`;
            });
            return html;
        };

        const buildMobileNav = () => {
            let html = '';
            Object.entries(modulesByGroup).forEach(([groupName, items]) => {
                // Section Header for Mobile
                html += `<div class="px-4 pt-4 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">${groupName}</div>`;
                
                items.forEach(m => {
                    const id = `nav-${m.id}-mobile`;
                    html += `<button id="${id}" class="w-full text-left py-3.5 px-4 text-sm hover:bg-indigo-50 flex items-center text-slate-700 font-bold transition-colors">
                        <i class="fa-solid ${m.icon} mr-4 text-indigo-400 w-5 text-center"></i>${m.label}
                    </button>`;
                });
            });
            return html;
        };

        this.navContainer.innerHTML = buildDesktopNav();
        if (this.mobileNavContainer) {
            this.mobileNavContainer.innerHTML = buildMobileNav();
        }

        // Re-attach listeners
        Object.values(this.modules).forEach(m => {
            const btn = document.getElementById(`nav-${m.id}`);
            if (btn) btn.onclick = () => this.setView(m.id);
            
            const mobileBtn = document.getElementById(`nav-${m.id}-mobile`);
            if (mobileBtn) mobileBtn.onclick = () => {
                this.setView(m.id);
                const mobileMenu = document.querySelector('.mobile-menu');
                if (mobileMenu) mobileMenu.classList.add('hidden');
            };
        });
    }

    setView(viewId) {
        if (!this.modules[viewId]) {
            console.error(`Module not found: ${viewId}`);
            return;
        }

        // Trigger balance refresh when navigating to the accounts view if any are dirty
        if (viewId === 'accounts' && currentUserId) {
            const hasDirtyAccounts = state.accounts.some(acc => acc.balanceDirty !== false);
            if (hasDirtyAccounts) {
                markAccountsBalanceDirty(currentUserId);
            }
        }

        this.currentModule = this.modules[viewId];
        updateState({ currentView: viewId });
        window.location.hash = viewId;
        
        this.render();
    }

    render() {
        if (!this.currentModule) return;

        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        // Show/Hide Shared Month Selection
        const sharedMonthSelection = document.getElementById('shared-month-selection');
        if (sharedMonthSelection) {
            if (this.currentModule.showMonthSelection) {
                sharedMonthSelection.classList.remove('hidden');
            } else {
                sharedMonthSelection.classList.add('hidden');
            }
        }

        // Update Nav Active State
        Object.values(this.modules).forEach(m => {
            const btns = [document.getElementById(`nav-${m.id}`), document.getElementById(`nav-${m.id}-mobile`)];
            btns.forEach(btn => {
                if (!btn) return;
                const isActive = m.id === this.currentModule.id;
                if (isActive) {
                    btn.classList.add('text-indigo-600', 'border-indigo-600', 'bg-indigo-50/50');
                    btn.classList.remove('border-transparent');
                } else {
                    btn.classList.remove('text-indigo-600', 'border-indigo-600', 'bg-indigo-50/50');
                    btn.classList.add('border-transparent');
                }
            });
        });

        // Show/Hide Mobile FAB
        const mobileFab = document.getElementById('mobile-fab');
        if (mobileFab) {
            if (this.currentModule.showMobileFab && this.currentModule.showMobileFab()) {
                mobileFab.classList.remove('hidden');
            } else {
                mobileFab.classList.add('hidden');
            }
        }

        // Render Module Template
        appContent.innerHTML = this.currentModule.getTemplate();
        
        // Call Module Render logic
        try {
            this.currentModule.render();
        } catch (renderErr) {
            console.error(`[Router] Render failed for ${this.currentModule.id}:`, renderErr);
        }
    }
}

export const router = new AppRouter();
