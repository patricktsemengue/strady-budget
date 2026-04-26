import { state, updateState } from './state.js';
import { markAccountsBalanceDirty } from './firestore-service.js';
import { currentUserId } from './storage.js';
import { t } from './i18n.js';

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
            const accent = m.accentColor || 'indigo';
            
            btns.forEach(btn => {
                if (!btn) return;
                const isActive = m.id === this.currentModule.id;
                
                // Reset common colors
                const colors = ['indigo', 'emerald', 'rose', 'amber', 'slate', 'violet', 'blue'];
                colors.forEach(c => {
                    btn.classList.remove(`text-${c}-600`, `border-${c}-600`, `bg-${c}-50/50`);
                });

                if (isActive) {
                    btn.classList.add(`text-${accent}-600`, `border-${accent}-600`, `bg-${accent}-50/50`);
                    btn.classList.remove('border-transparent');
                } else {
                    btn.classList.add('border-transparent');
                }
            });
        });

        // Show/Hide Mobile FAB
        const mobileFab = document.getElementById('mobile-fab');
        if (mobileFab) {
            if (this.currentModule.getFabConfig) {
                const config = this.currentModule.getFabConfig();
                if (config) {
                    mobileFab.classList.remove('hidden');
                    mobileFab.className = `md:hidden fixed bottom-6 right-6 w-14 h-14 ${config.color || 'bg-slate-800'} text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-all active:scale-95`;
                    mobileFab.innerHTML = `<i class="fa-solid ${config.icon || 'fa-plus'} text-xl"></i>`;
                    mobileFab.onclick = config.action;
                } else {
                    mobileFab.classList.add('hidden');
                }
            } else if (this.currentModule.showMobileFab && this.currentModule.showMobileFab()) {
                mobileFab.classList.remove('hidden');
                mobileFab.className = `md:hidden fixed bottom-6 right-6 w-14 h-14 bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-all active:scale-95`;
                mobileFab.innerHTML = `<i class="fa-solid fa-plus text-xl"></i>`;
                mobileFab.onclick = () => window.app.openTransactionModal();
            } else {
                mobileFab.classList.add('hidden');
            }
        }

        // Help Card Logic
        const helpId = `help_dismissed_${this.currentModule.id}`;
        const isDismissed = localStorage.getItem(helpId) === 'true';
        const helpContent = this.currentModule.getHelpContent ? this.currentModule.getHelpContent() : null;
        const currentAccent = this.currentModule.accentColor || 'indigo';
        
        let helpHtml = '';
        if (helpContent && !isDismissed) {
            helpHtml = `
                <div class="max-w-6xl mx-auto px-4 mt-4">
                    <div id="screen-help-card" class="help-card animate-fadeIn border-l-4 border-${currentAccent}-600">
                        <button onclick="window.app.dismissHelp('${this.currentModule.id}')" class="help-card-close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                        <div class="help-badge bg-${currentAccent}-50 text-${currentAccent}-700">${t('help_cards.badge')}</div>
                        <h2 class="text-lg font-black text-slate-800 mb-2">${helpContent.title}</h2>
                        <p class="text-sm text-slate-600 leading-relaxed mb-4">${helpContent.purpose}</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 border-t border-slate-100 pt-4">
                            ${helpContent.actions.map(action => `
                                <div class="flex items-start gap-3">
                                    <div class="mt-1 w-5 h-5 rounded-full bg-${currentAccent}-50 text-${currentAccent}-600 flex items-center justify-center shrink-0">
                                        <i class="fa-solid ${action.icon} text-[10px]"></i>
                                    </div>
                                    <div>
                                        <p class="text-xs font-bold text-slate-700">${action.label}</p>
                                        <p class="text-[10px] text-slate-400 font-medium">${action.desc}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else if (helpContent) {
            // Mini button to reopen
            helpHtml = `
                <div class="max-w-6xl mx-auto px-4 mt-2 flex justify-end">
                    <button onclick="window.app.showHelp('${this.currentModule.id}')" class="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-${currentAccent}-600 transition-colors flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
                        <i class="fa-solid fa-circle-question"></i> ${t('help_cards.btn_help')}
                    </button>
                </div>
            `;
        }

        // Render Module Template
        appContent.innerHTML = helpHtml + this.currentModule.getTemplate();
        
        // Call Module Render logic
        try {
            this.currentModule.render();
        } catch (renderErr) {
            console.error(`[Router] Render failed for ${this.currentModule.id}:`, renderErr);
        }
    }

    dismissHelp(moduleId) {
        localStorage.setItem(`help_dismissed_${moduleId}`, 'true');
        this.render();
    }

    showHelp(moduleId) {
        localStorage.removeItem(`help_dismissed_${moduleId}`);
        this.render();
    }
}

export const router = new AppRouter();
